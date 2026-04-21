import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { FraudEngine } from "./src/services/fraudEngine.ts";
import { Transaction } from "./src/types.ts";
import { v4 as uuidv4 } from "uuid";
import { fraudQueue, createFraudWorker } from "./src/lib/queue.ts";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const PORT = 3000;
  const engine = new FraudEngine();

  app.use(express.json());
  app.use(cors());

  // --- Production Stats Logic ---
  const stats = { totalRequests: 0, fraudAlerts: 0, totalProbability: 0, latencyBuffer: [] as number[] };

  /**
   * PRODUCTION WORKER (BullMQ)
   * This processes jobs from Redis (or mock) in the background.
   */
  createFraudWorker(async (job) => {
    const startTime = Date.now();
    const transaction: Transaction = job.data;
    
    // 1. Run Inference
    const prediction = await engine.predict(transaction);
    
    // 2. Persist to Database (Prisma)
    try {
      await prisma.transaction.create({
        data: {
          id: transaction.id,
          userId: transaction.userId,
          amount: transaction.amount,
          currency: transaction.currency,
          timestamp: new Date(transaction.timestamp),
          locationCity: transaction.location.city,
          locationCountry: transaction.location.country,
          deviceId: transaction.deviceId,
          merchantId: transaction.merchantId,
          riskScore: prediction.probability,
          riskLevel: prediction.riskLevel,
          reasons: JSON.stringify(prediction.reasons),
          modelType: prediction.modelDetails.type,
          modelVersion: prediction.modelDetails.version
        }
      });
    } catch (dbError) {
      console.error("Persistence Error:", dbError);
    }

    const latency = Date.now() - startTime;
    stats.totalRequests++;
    if (prediction.probability > 0.45) stats.fraudAlerts++;
    stats.totalProbability += prediction.probability;
    stats.latencyBuffer.push(latency);
    if (stats.latencyBuffer.length > 100) stats.latencyBuffer.shift();

    // 3. Broadcast Result
    const payload = JSON.stringify({ type: "PREDICTION_EVENT", data: { txn: transaction, prediction } });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
    
    return prediction;
  });

  // --- API Routes ---
  app.post("/api/predict", async (req, res) => {
    const transaction: Transaction = {
      ...req.body,
      id: req.body.id || uuidv4().split("-")[0],
      timestamp: req.body.timestamp || new Date().toISOString()
    };
    
    // Add to BullMQ Queue
    await fraudQueue.add("analyze-fraud", transaction);
    
    res.status(202).json({ 
      status: "ACCEPTED", 
      transactionId: transaction.id,
      queue: "bullmq-redis"
    });
  });

  app.get("/api/stats", async (req, res) => {
    const avgLatency = stats.latencyBuffer.length > 0
      ? stats.latencyBuffer.reduce((a, b) => a + b, 0) / stats.latencyBuffer.length
      : 0;

    // In a real app, you'd query these from Postgres for total accuracy
    res.json({
      totalRequests: stats.totalRequests,
      fraudAlerts: stats.fraudAlerts,
      avgProbability: stats.totalRequests > 0 ? stats.totalProbability / stats.totalRequests : 0,
      avgLatency,
      historySize: engine.getHistorySize()
    });
  });

  // --- WebSocket Handler ---
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "SYSTEM_READY", mode: "BULLMQ_WORKER_ACTIVE" }));
  });

  // --- Build/Serve SPA ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Sentinal AI] Production Pipeline Active on Port ${PORT}`);
  });
}

startServer().catch(console.error);
