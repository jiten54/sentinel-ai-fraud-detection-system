import { Transaction, PredictionResult, RiskLevel, FeatureImportance } from "../types.ts";
import { LogisticRegressionModel } from "../lib/mlEngine.ts";

/**
 * Advanced Fraud Detection Engine (Real Logistic Regression Inference)
 * Used by the BullMQ worker for production-grade throughput.
 */
export class FraudEngine {
  private history: Transaction[] = [];
  private model = new LogisticRegressionModel();

  public async predict(transaction: Transaction): Promise<PredictionResult> {
    const reasons: string[] = [];
    
    // --- 1. Feature Engineering (Data Preprocessing) ---

    // Velocity Feature
    const recentTxns = this.history.filter(
      (t) => 
        t.userId === transaction.userId && 
        new Date(t.timestamp).getTime() > new Date(transaction.timestamp).getTime() - (5 * 60 * 1000)
    );
    const velocityFeature = Math.min(recentTxns.length / 5, 1.0); 

    // Amount Anomaly (Z-Score approximation)
    const userTxns = this.history.filter((t) => t.userId === transaction.userId);
    let amountZFeature = 0;
    if (userTxns.length > 5) {
      const avg = userTxns.reduce((sum, t) => sum + t.amount, 0) / userTxns.length;
      const stdDev = Math.sqrt(userTxns.reduce((sum, t) => sum + Math.pow(t.amount - avg, 2), 0) / userTxns.length) || 1;
      amountZFeature = Math.min(Math.max((transaction.amount - avg) / stdDev / 3, 0), 1.0);
    }

    // Impossible Travel 
    let travelFeature = 0;
    if (userTxns.length > 0) {
      const lastTxn = userTxns[userTxns.length - 1];
      const dist = this.calculateDistance(lastTxn.location.lat, lastTxn.location.lng, transaction.location.lat, transaction.location.lng);
      const timeHours = (new Date(transaction.timestamp).getTime() - new Date(lastTxn.timestamp).getTime()) / 3600000;
      if (timeHours > 0) travelFeature = Math.min((dist / timeHours) / 900, 1.0);
    }

    const roundAmountFeature = (transaction.amount % 100 === 0 && transaction.amount > 100) ? 1.0 : 0;
    const isNewDeviceFeature = !userTxns.some(t => t.deviceId === transaction.deviceId) ? 1.0 : 0;

    // --- 2. Real ML Inference ---
    const probability = this.model.predict({
      velocity: velocityFeature,
      amountZ: amountZFeature,
      travel: travelFeature,
      newDevice: isNewDeviceFeature,
      roundAmount: roundAmountFeature
    });

    // --- 3. Interpretability ---
    const featureImportance: FeatureImportance[] = [
      { feature: "Velocity", weight: 2.45, impact: velocityFeature * 0.35 },
      { feature: "Amount Z-Score", weight: 1.82, impact: amountZFeature * 0.25 },
      { feature: "Impossible Travel", weight: 3.12, impact: travelFeature * 0.30 },
      { feature: "Device History", weight: 1.15, impact: isNewDeviceFeature * 0.05 },
      { feature: "Payload Pattern", weight: 0.45, impact: roundAmountFeature * 0.05 }
    ];

    if (velocityFeature > 0.6) reasons.push("Anomalous transaction frequency (Velocity Alert)");
    if (amountZFeature > 0.7) reasons.push("Transaction value exceeds historical baseline");
    if (travelFeature > 0.8) reasons.push("Geographical travel speed is biologically impossible");

    let riskLevel = RiskLevel.LOW;
    if (probability > 0.7) riskLevel = RiskLevel.HIGH;
    else if (probability > 0.35) riskLevel = RiskLevel.MEDIUM;

    this.history.push(transaction);
    if (this.history.length > 2000) this.history.shift();

    return {
      transactionId: transaction.id,
      probability,
      riskLevel,
      reasons,
      timestamp: new Date().toISOString(),
      featureImportance,
      modelDetails: {
        type: "LogisticRegression-Production",
        version: "v3.1.0-Deployed"
      }
    };
  }

  public getHistorySize(): number {
    return this.history.length;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
