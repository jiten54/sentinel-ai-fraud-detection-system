/**
 * Shared types for the Fraud Detection API
 */

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high"
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  timestamp: string;
  location: {
    lat: number;
    lng: number;
    city: string;
    country: string;
  };
  deviceId: string;
  merchantId: string;
  merchantCategory: string;
  status: "pending" | "completed" | "failed";
}

export interface FeatureImportance {
  feature: string;
  weight: number;
  impact: number; // contribution to final score
}

export interface PredictionResult {
  transactionId: string;
  probability: number;
  riskLevel: RiskLevel;
  reasons: string[];
  timestamp: string;
  featureImportance: FeatureImportance[];
  modelDetails: {
    type: string;
    version: string;
  };
}

export interface AppStats {
  totalTransactions: number;
  fraudDetected: number;
  averageLatency: number;
}
