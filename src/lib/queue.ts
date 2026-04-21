import { Queue as BullQueue, Worker as BullWorker, Job } from "bullmq";
import IORedis from "ioredis";
import EventEmitter from "events";

/**
 * PRODUCTION-READY QUEUE BRIDGE
 * 
 * BullMQ requires a real Redis server for its Lua-based processing.
 * Since Redis is not available in the preview environment, we use a 
 * "Preview Bridge" that mimics BullMQ's API using Node.js events.
 */

const isProduction = process.env.NODE_ENV === "production" || process.env.REDIS_URL;

class PreviewQueue extends EventEmitter {
  public async add(name: string, data: any) {
    // Mimic BullMQ async behavior
    setImmediate(() => {
      this.emit("job", { name, data, id: Math.random().toString(36).substr(2, 9) });
    });
    return { id: "preview-job" };
  }
}

let activeQueue: any;
const connection = isProduction ? new IORedis(process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null }) : null;

if (isProduction && connection) {
  activeQueue = new BullQueue("fraud-processing", { connection });
} else {
  activeQueue = new PreviewQueue();
}

export const fraudQueue = activeQueue;

export const createFraudWorker = (processor: (job: any) => Promise<any>) => {
  if (isProduction && connection) {
    return new BullWorker("fraud-processing", processor, { connection, concurrency: 5 });
  } else {
    // Preview worker listener
    fraudQueue.on("job", async (job: any) => {
      try {
        await processor(job);
      } catch (err) {
        console.error("Preview Worker Error:", err);
      }
    });
    return { name: "preview-worker" };
  }
};
