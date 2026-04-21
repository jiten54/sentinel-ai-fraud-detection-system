import React, { useState, useEffect, useCallback } from "react";
import { 
  ShieldAlert, 
  ShieldCheck, 
  ShieldQuestion, 
  Activity, 
  Zap, 
  Database, 
  Plus, 
  RefreshCw,
  MapPin,
  CreditCard,
  User,
  AlertTriangle
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { Transaction, PredictionResult, RiskLevel } from "./types";

interface Stats {
  totalRequests: number;
  fraudAlerts: number;
  avgProbability: number;
  avgLatency: number;
  historySize: number;
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [transactions, setTransactions] = useState<Array<{ txn: Transaction; prediction: PredictionResult }>>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [connStatus, setConnStatus] = useState<"connecting" | "open" | "closed">("connecting");

  // WebSocket Connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const socket = new WebSocket(`${protocol}//${host}`);

    socket.onopen = () => setConnStatus("open");
    socket.onclose = () => setConnStatus("closed");
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "PREDICTION_EVENT") {
        const { txn, prediction } = msg.data;
        setTransactions(prev => [{ txn, prediction }, ...prev].slice(0, 50));
      }
    };

    return () => socket.close();
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
      
      setChartData(prev => {
        const newData = [...prev, { time: format(new Date(), "HH:mm:ss"), fraudRate: data.avgProbability * 100 }];
        if (newData.length > 20) newData.shift();
        return newData;
      });
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const runSimulation = async () => {
    setIsSimulating(true);
    
    // Random transaction generator
    const generateRandomTxn = (): Partial<Transaction> => {
      const isFraud = Math.random() > 0.85;
      const userId = `user_${Math.floor(Math.random() * 5) + 1}`; 
      
      const locations = [
        { lat: 40.7128, lng: -74.0060, city: "New York", country: "USA" },
        { lat: 34.0522, lng: -118.2437, city: "Los Angeles", country: "USA" },
        { lat: 51.5074, lng: -0.1278, city: "London", country: "UK" },
        { lat: 48.8566, lng: 2.3522, city: "Paris", country: "France" },
        { lat: 19.0760, lng: 72.8777, city: "Mumbai", country: "India" }
      ];
      
      const location = locations[Math.floor(Math.random() * locations.length)];
      
      return {
        userId,
        amount: isFraud ? Math.floor(Math.random() * 9000) + 900 : Math.floor(Math.random() * 400) + 10,
        currency: "USD",
        location,
        deviceId: `dev_${Math.floor(Math.random() * 10)}`,
        merchantId: `merchant_${Math.floor(Math.random() * 20)}`,
        merchantCategory: "retail",
        status: "pending"
      };
    };

    try {
      // Send multiple to test the queue
      const batch = Array.from({ length: 3 }).map(() => generateRandomTxn());
      for (const txn of batch) {
        await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(txn)
        });
      }
    } catch (err) {
      console.error("Simulation failed", err);
    } finally {
      setTimeout(() => setIsSimulating(false), 500);
    }
  };

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.HIGH: return "text-red-500 bg-red-500/10 border-red-500/20";
      case RiskLevel.MEDIUM: return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case RiskLevel.LOW: return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    }
  };

  const getRiskIcon = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.HIGH: return <ShieldAlert className="w-4 h-4" />;
      case RiskLevel.MEDIUM: return <ShieldQuestion className="w-4 h-4" />;
      case RiskLevel.LOW: return <ShieldCheck className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-slate-50 font-sans selection:bg-brand-accent/30">
      {/* Header */}
      <header className="border-b border-brand-border/50 bg-brand-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand-accent p-2 rounded-lg shadow-lg shadow-brand-accent/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight leading-none mb-1">Sentinel AI</h1>
              <p className="text-[11px] text-brand-faint font-medium uppercase tracking-[0.2em]">Fraud Monitoring System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={runSimulation}
              disabled={isSimulating}
              className="flex items-center gap-2 bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 transition-all text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-brand-accent/20"
            >
              {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              {isSimulating ? "Processing..." : "Generate Transaction"}
            </button>
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-success/10 border border-brand-success/20 rounded-full">
                <div className={`w-1.5 h-1.5 rounded-full ${connStatus === 'open' ? 'bg-brand-success animate-pulse' : 'bg-brand-danger'}`} />
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${connStatus === 'open' ? 'text-brand-success' : 'text-brand-danger'}`}>
                  {connStatus === 'open' ? 'Stream: Connected' : 'Stream: Offline'}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-accent/10 border border-brand-accent/20 rounded-full">
                <span className="text-[11px] font-semibold text-brand-accent uppercase tracking-wider">v2.4.1-Prod</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard 
            title="Total Transactions" 
            value={stats?.totalRequests.toLocaleString() || 0} 
            icon={<Activity className="text-brand-accent w-5 h-5" />} 
            description="↑ 12.4% vs last 24h"
          />
          <StatCard 
            title="Fraud Detection Rate" 
            value={`${(stats?.avgProbability || 0).toFixed(2)}%`} 
            icon={<AlertTriangle className="text-brand-warning w-5 h-5" />} 
            description="-0.02% variance"
            highlight={stats && stats.fraudAlerts > 0 && stats.fraudAlerts > stats.totalRequests * 0.1 ? "danger" : undefined}
          />
          <StatCard 
            title="Avg Inference Latency" 
            value={`${Math.round(stats?.avgLatency || 0)}ms`} 
            icon={<Zap className="text-brand-success w-5 h-5" />} 
            description="↑ 0.8ms (High load)"
          />
          <StatCard 
            title="History Pool" 
            value={stats?.historySize || 0} 
            icon={<Database className="text-brand-faint w-5 h-5" />} 
            description="Active cache sync"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-10">
            <section className="bg-brand-surface border border-brand-border rounded-xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-bold text-lg text-slate-100">Fraud Intensity Index</h3>
                  <p className="text-xs text-brand-faint mt-1">Real-time model distribution analysis</p>
                </div>
                <div className="text-[11px] uppercase font-mono text-brand-faint bg-brand-bg px-2 py-1 rounded">POST /predict</div>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorFraud" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                      dataKey="time" 
                      hide
                    />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#3b82f6' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="fraudRate" 
                      stroke="#3b82f6" 
                      fillOpacity={1} 
                      fill="url(#colorFraud)" 
                      strokeWidth={3}
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Recent Transactions List */}
            <section className="bg-brand-surface border border-brand-border rounded-xl p-8 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-lg text-slate-100">Live Prediction Stream</h3>
                <div className="flex items-center gap-5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand-success">
                    <div className="w-2 h-2 rounded-full bg-brand-success" /> LOW
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand-warning">
                    <div className="w-2 h-2 rounded-full bg-brand-warning" /> MED
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand-danger">
                    <div className="w-2 h-2 rounded-full bg-brand-danger" /> HIGH
                  </div>
                </div>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {transactions.map(({ txn, prediction }) => (
                    <motion.div 
                      key={txn.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-5 rounded-xl border transition-all duration-200 hover:border-brand-accent/50 ${
                        prediction.riskLevel === RiskLevel.HIGH 
                          ? "bg-brand-danger/5 border-brand-danger/20" 
                          : prediction.riskLevel === RiskLevel.MEDIUM 
                          ? "bg-brand-warning/5 border-brand-warning/30" 
                          : "bg-brand-bg/50 border-brand-border"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex gap-5">
                          <div className={`p-3 rounded-xl shrink-0 h-fit border ${getRiskColor(prediction.riskLevel)}`}>
                            {getRiskIcon(prediction.riskLevel)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-3 mb-2">
                              <span className="text-lg font-bold text-slate-100">${txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              <span className="text-xs font-mono text-brand-muted tracking-tight">TXN-{txn.id.toUpperCase()}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs font-medium text-brand-muted">
                              <div className="flex items-center gap-2 truncate"><User className="w-3.5 h-3.5" /> <span className="truncate">{txn.userId}</span></div>
                              <div className="flex items-center gap-2 truncate"><MapPin className="w-3.5 h-3.5" /> <span className="truncate">{txn.location.city}, {txn.location.country}</span></div>
                              <div className="flex items-center gap-2 truncate"><CreditCard className="w-3.5 h-3.5" /> <span className="truncate">{txn.merchantId}</span></div>
                            </div>
                            {prediction.reasons.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                                <p className="text-[10px] font-black text-brand-faint uppercase tracking-widest mb-1 opacity-70">Detection Logic</p>
                                {prediction.reasons.map((r, i) => (
                                  <p key={i} className="text-[10px] text-brand-danger/90 font-semibold flex items-start gap-2 leading-tight">
                                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                    {r}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Feature Importance Histogram */}
                            <div className="mt-4 pt-4 border-t border-white/5 bg-black/10 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-3">
                                 <p className="text-[10px] font-black text-brand-faint uppercase tracking-widest opacity-70">Feature Impact (ML Inference)</p>
                                 <span className="text-[9px] font-mono text-brand-muted bg-brand-bg px-1.5 py-0.5 rounded border border-brand-border">{prediction.modelDetails.version}</span>
                              </div>
                              <div className="space-y-2">
                                {prediction.featureImportance.filter(f => f.impact > 0).map((f, i) => (
                                  <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold text-brand-muted tracking-tight">
                                      <span>{f.feature}</span>
                                      <span className="font-mono">{Math.round((f.impact / prediction.probability) * 100)}%</span>
                                    </div>
                                    <div className="h-1 bg-brand-bg rounded-full overflow-hidden border border-white/5">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(f.impact / prediction.probability) * 100}%` }}
                                        className={`h-full ${f.impact > 0.2 ? 'bg-brand-danger' : f.impact > 0.1 ? 'bg-brand-warning' : 'bg-brand-accent'}`}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 text-right shrink-0">
                          <div className="md:mb-auto">
                            <p className="text-[11px] font-mono font-bold text-brand-faint uppercase tracking-tighter">
                              {format(new Date(txn.timestamp), "HH:mm:ss.SSS")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-black uppercase tracking-widest ${getRiskColor(prediction.riskLevel)}`}>
                              {prediction.riskLevel}
                            </p>
                            <p className="text-[11px] font-mono text-brand-faint font-bold mt-0.5">Score: {prediction.probability.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed border-brand-border rounded-2xl">
                      <ShieldQuestion className="w-16 h-16 text-brand-surface mx-auto mb-6" />
                      <p className="text-brand-faint font-medium">No activity detected in prediction stream.</p>
                      <p className="text-xs text-brand-muted mt-2">Trigger a simulation to monitor incoming events.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-10">
            <section className="bg-brand-accent rounded-xl p-8 text-white relative overflow-hidden shadow-2xl shadow-brand-accent/20">
              <div className="relative z-10">
                <h3 className="font-bold text-xl mb-3">Model Intelligence</h3>
                <p className="text-blue-100 text-sm leading-relaxed mb-8 opacity-90">
                  Global telemetry processing active. System adapting to current network load.
                </p>
                <div className="space-y-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <p className="text-[10px] uppercase font-black text-blue-200 tracking-widest mb-1.5">Primary Cluster</p>
                    <p className="text-sm font-bold flex items-center justify-between">K8S-PROD-01 <span className="text-[10px] font-mono opacity-60">US-EAST-1</span></p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <p className="text-[10px] uppercase font-black text-blue-200 tracking-widest mb-1.5">Inference Status</p>
                    <p className="text-sm font-bold flex items-center justify-between">Inference-B <span className="text-[10px] font-mono opacity-60">Active</span></p>
                  </div>
                </div>
              </div>
              {/* Abstract decorations */}
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-white/10 rounded-full blur-3xl opacity-50" />
              <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-32 h-32 bg-black/10 rounded-full blur-2xl opacity-50" />
            </section>

            <section className="bg-brand-surface border border-brand-border rounded-xl p-8 shadow-2xl">
              <h3 className="font-bold text-lg text-slate-100 mb-8">System Health</h3>
              <div className="space-y-5">
                <HealthIndicator label="PostgreSQL" status="Connected" color="brand-success" />
                <HealthIndicator label="Redis Cache" status="92% Hit Rate" color="brand-success" />
                <HealthIndicator label="Model Service" status="v2.4.1" color="brand-accent" />
                <HealthIndicator label="CPU Load" status="Low" color="brand-success" />
              </div>

              <div className="mt-12 pt-8 border-t border-brand-border">
                <div className="flex justify-between items-center text-[10px] font-mono text-brand-faint uppercase tracking-widest">
                  <span>&copy; 2024 Sentinel AI</span>
                  <span>Fintech Labs</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

function StatCard({ title, value, icon, description, highlight }: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  description: string;
  highlight?: "danger" | "warning";
}) {
  return (
    <div className={`p-7 rounded-xl border transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl ${
      highlight === "danger" 
        ? "bg-brand-danger/10 border-brand-danger/30" 
        : "bg-brand-surface border-brand-border shadow-xl"
    }`}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] font-bold text-brand-muted uppercase tracking-[0.1em]">{title}</span>
        <div className="p-2.5 bg-brand-bg rounded-lg border border-brand-border">
          {icon}
        </div>
      </div>
      <div className="text-3xl font-black text-slate-50 tracking-tight mb-2 leading-none">{value}</div>
      <p className={`text-[10px] font-bold flex items-center gap-1 ${
        description.includes("↑") ? "text-brand-success" : 
        description.includes("↓") ? "text-brand-danger" : "text-brand-faint"
      }`}>
        {description}
      </p>
    </div>
  );
}

function HealthIndicator({ label, status, color }: { label: string; status: string; color: string }) {
  const colorMap: Record<string, string> = {
    'brand-success': 'text-brand-success',
    'brand-accent': 'text-brand-accent',
    'brand-warning': 'text-brand-warning',
    'brand-danger': 'text-brand-danger'
  };

  return (
    <div className="flex items-center justify-between py-1 px-1">
      <span className="text-xs font-semibold text-brand-muted">{label}</span>
      <span className={`text-[11px] font-bold ${colorMap[color] || 'text-slate-400'} tracking-tight`}>{status}</span>
    </div>
  );
}

function SecurityRule({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-brand-bg/40 border border-brand-border rounded-xl">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <div className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${
        active ? "bg-brand-success/10 text-brand-success border border-brand-success/30" : "bg-slate-500/10 text-slate-500 border border-slate-500/30"
      }`}>
        {active ? "Active" : "Disabled"}
      </div>
    </div>
  );
}
