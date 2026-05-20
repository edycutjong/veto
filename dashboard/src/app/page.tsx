"use client";

import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────

interface TradeAttempt {
  id: number;
  asset: string;
  status: "blocked" | "executed" | "pending";
  varianceBps: number;
  thresholdBps: number;
  value: string;
  timestamp: Date;
  prices: number[];
}

// ─── Demo Data ────────────────────────────────────────────────

const DEMO_TRADES: TradeAttempt[] = [
  {
    id: 1,
    asset: "RUGCOIN",
    status: "blocked",
    varianceBps: 286966565,
    thresholdBps: 1000,
    value: "2.0 ETH",
    timestamp: new Date(Date.now() - 120000),
    prices: [0.5, 1.2, 0.3, 2.5, 0.1, 5.0, 0.8, 0.15, 3.2, 0.05, 8.0, 0.4, 0.08, 4.5, 0.02],
  },
  {
    id: 2,
    asset: "ETH",
    status: "executed",
    varianceBps: 54,
    thresholdBps: 1000,
    value: "1.0 ETH",
    timestamp: new Date(Date.now() - 60000),
    prices: [3241.57, 3238.22, 3245.1, 3240.88, 3236.75, 3242.3, 3239.5, 3244.15, 3237.9, 3241.0, 3243.2, 3238.8, 3240.5, 3242.75, 3239.1],
  },
];

// ─── Components ───────────────────────────────────────────────

function StatusBadge({ status }: { status: "blocked" | "executed" | "pending" }) {
  const styles = {
    blocked: "bg-red-500/10 text-red-400 border-red-500/30",
    executed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  };

  const labels = {
    blocked: "🚨 BLOCKED",
    executed: "✅ EXECUTED",
    pending: "⏳ PENDING",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-mono border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
  subtitle,
}: {
  label: string;
  value: string | number;
  accent: "cyan" | "red" | "green" | "amber";
  subtitle?: string;
}) {
  const accentColors = {
    cyan: "text-cyan-400 border-cyan-500/20",
    red: "text-red-400 border-red-500/20",
    green: "text-emerald-400 border-emerald-500/20",
    amber: "text-amber-400 border-amber-500/20",
  };

  return (
    <div className={`glass-card border-gradient p-5`}>
      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className={`text-2xl font-mono font-bold ${accentColors[accent]}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-600 mt-1 font-mono">{subtitle}</p>}
    </div>
  );
}

function PriceChart({ prices, blocked }: { prices: number[]; blocked: boolean }) {
  if (!prices.length) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const width = 300;
  const height = 80;
  const padding = 4;

  const points = prices
    .map((p, i) => {
      const x = padding + (i / (prices.length - 1)) * (width - padding * 2);
      const y = height - padding - ((p - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const color = blocked ? "#ef4444" : "#06b6d4";
  const glowColor = blocked ? "rgba(239,68,68,0.3)" : "rgba(6,182,212,0.3)";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${blocked}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <filter id={`glow-${blocked}`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Area fill */}
      <polygon
        points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        fill={`url(#grad-${blocked})`}
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        filter={`url(#glow-${blocked})`}
      />
      {/* Threshold line */}
      <line
        x1={padding}
        y1={height / 2}
        x2={width - padding}
        y2={height / 2}
        stroke={glowColor}
        strokeWidth="0.5"
        strokeDasharray="4,4"
      />
    </svg>
  );
}

function TradeRow({ trade }: { trade: TradeAttempt }) {
  const isBlocked = trade.status === "blocked";
  const rowClass = isBlocked ? "border-red-500/20 hover:border-red-500/40" : "border-emerald-500/20 hover:border-emerald-500/40";

  return (
    <div className={`glass-card p-4 mb-3 border ${rowClass} transition-all ${isBlocked ? "flash-red" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-mono font-bold text-slate-200">{trade.asset}</span>
          <StatusBadge status={trade.status} />
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {trade.timestamp.toLocaleTimeString()}
        </span>
      </div>

      <PriceChart prices={trade.prices} blocked={isBlocked} />

      <div className="grid grid-cols-3 gap-3 mt-3">
        <div>
          <p className="text-[10px] text-slate-600 uppercase">Variance</p>
          <p className={`text-sm font-mono font-semibold ${isBlocked ? "text-red-400" : "text-cyan-400"}`}>
            {trade.varianceBps.toLocaleString()} bps
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-600 uppercase">Threshold</p>
          <p className="text-sm font-mono text-slate-400">{trade.thresholdBps} bps</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-600 uppercase">Value</p>
          <p className="text-sm font-mono text-slate-300">{trade.value}</p>
        </div>
      </div>

      {isBlocked && (
        <div className="mt-3 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
          <p className="text-[11px] font-mono text-red-400">
            <span className="text-red-500 font-bold">Custom Error:</span>{" "}
            VolatilityExceedsThreshold({trade.varianceBps}, {trade.thresholdBps})
          </p>
        </div>
      )}
    </div>
  );
}

function AgentTerminal() {
  const [lines] = useState([
    { text: "$ aegisvault-agent --mode demo", type: "cmd" as const },
    { text: "[Agent] Scanning DeFi markets for yield opportunities...", type: "info" as const },
    { text: "[Agent] Found: RUGCOIN pool — 10x APY on UniV3", type: "warn" as const },
    { text: "[Agent] Decision: Allocate 2.0 ETH → RUGCOIN swap", type: "warn" as const },
    { text: "[Agent] Fetching 50 historical prices from CoinGecko...", type: "info" as const },
    { text: "[Agent] Formatting price array as uint256[] calldata", type: "info" as const },
    { text: "[Agent] Submitting tx to AegisVault...", type: "info" as const },
    { text: "[Vault] → RiskEngine.checkVolatility(prices, 1000)", type: "info" as const },
    { text: "[Vault] Computing variance over 50 prices (WASM)...", type: "info" as const },
    { text: "[Vault] Variance: 286,966,565 bps > 1,000 bps limit", type: "error" as const },
    { text: "🚨 REVERTED: VolatilityExceedsThreshold(286966565, 1000)", type: "error" as const },
    { text: "", type: "info" as const },
    { text: "[Agent] Fallback: ETH staking pool — 4.2% APY", type: "info" as const },
    { text: "[Agent] Fetching ETH historical prices...", type: "info" as const },
    { text: "[Vault] → RiskEngine.checkVolatility(prices, 1000)", type: "info" as const },
    { text: "[Vault] Variance: 54 bps ≤ 1,000 bps limit", type: "success" as const },
    { text: "✅ EXECUTED: 1.0 ETH → staking pool", type: "success" as const },
    { text: "[Agent] Trade complete. Tx: 0xa1b2c3d4...e5f6a7b8", type: "success" as const },
  ]);

  const typeColors = {
    cmd: "text-cyan-300",
    info: "text-slate-500",
    warn: "text-amber-400",
    error: "text-red-400",
    success: "text-emerald-400",
  };

  return (
    <div className="glass-card p-4 h-full">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
        <span className="text-xs text-slate-600 font-mono ml-2">agent@aegisvault ~ python agent.py</span>
      </div>
      <div className="space-y-0.5 overflow-y-auto max-h-[500px]">
        {lines.map((line, i) => (
          <p key={i} className={`text-xs font-mono leading-relaxed ${typeColors[line.type]}`}>
            {line.text}
          </p>
        ))}
        <p className="text-xs font-mono text-cyan-400 animate-pulse mt-2">▌</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function Dashboard() {
  const [threshold, setThreshold] = useState(1000);
  const [trades] = useState<TradeAttempt[]>(DEMO_TRADES);
  const [shaking, setShaking] = useState(false);

  const handleSimulateBlock = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }, []);

  const executedCount = trades.filter((t) => t.status === "executed").length;
  const blockedCount = trades.filter((t) => t.status === "blocked").length;

  return (
    <div className={`scanline min-h-screen ${shaking ? "shake" : ""}`}>
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg font-bold shadow-lg shadow-cyan-500/20">
              🛡️
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-cyan-400">Aegis</span>
                <span className="text-slate-300">Vault</span>
              </h1>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest">WASM Risk Engine • Robinhood Chain</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="status-dot status-dot-live" />
            <span className="text-xs text-emerald-400 font-mono">DEMO MODE</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Vault Balance" value="10.0 ETH" accent="cyan" subtitle="Robinhood Chain" />
          <StatCard label="Trades Executed" value={executedCount} accent="green" subtitle="Within threshold" />
          <StatCard label="Trades Blocked" value={blockedCount} accent="red" subtitle="Variance exceeded" />
          <StatCard label="Funds Saved" value="2.0 ETH" accent="amber" subtitle="From blocked trades" />
        </div>

        {/* Threshold Control */}
        <div className="glass-card border-gradient p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-300">Human Control Panel</h2>
              <p className="text-xs text-slate-600">Set the maximum acceptable asset variance (owner only)</p>
            </div>
            <button
              onClick={handleSimulateBlock}
              className="px-4 py-2 text-xs font-mono rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
            >
              🧪 Simulate Block
            </button>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="flex-1 h-1.5 appearance-none rounded-full bg-slate-800 accent-cyan-500 cursor-pointer"
            />
            <div className="text-right min-w-[120px]">
              <span className="text-xl font-mono font-bold text-cyan-400">{threshold}</span>
              <span className="text-xs text-slate-600 ml-1">bps</span>
              <p className="text-[10px] text-slate-600">{(threshold / 100).toFixed(1)}% max variance</p>
            </div>
          </div>
        </div>

        {/* Split View: Trade History + Agent Terminal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Trade History */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              Trade Execution Log
            </h2>
            {trades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>

          {/* Right: Agent Terminal */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-glow" />
              Agent Execution Terminal
            </h2>
            <AgentTerminal />
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="glass-card border-gradient p-6 mt-8">
          <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Architecture</h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-center">
            <div className="glass-card p-4 min-w-[160px]">
              <p className="text-xs text-slate-600 uppercase mb-1">AI Agent</p>
              <p className="text-sm font-mono text-amber-400">Python</p>
              <p className="text-[10px] text-slate-600 mt-1">Fetches prices</p>
              <p className="text-[10px] text-slate-600">Signs transactions</p>
            </div>
            <span className="text-cyan-600 text-xl">→</span>
            <div className="glass-card p-4 min-w-[160px] border-cyan-500/30">
              <p className="text-xs text-slate-600 uppercase mb-1">Vault</p>
              <p className="text-sm font-mono text-cyan-400">Solidity (EVM)</p>
              <p className="text-[10px] text-slate-600 mt-1">Holds funds</p>
              <p className="text-[10px] text-slate-600">Access control</p>
            </div>
            <span className="text-cyan-600 text-xl">→</span>
            <div className="glass-card p-4 min-w-[160px] glow-cyan border-cyan-500/20">
              <p className="text-xs text-slate-600 uppercase mb-1">Risk Engine</p>
              <p className="text-sm font-mono text-cyan-400 font-bold">Rust / Stylus</p>
              <p className="text-[10px] text-slate-600 mt-1">WASM math</p>
              <p className="text-[10px] text-slate-600">Variance computation</p>
            </div>
            <span className="text-2xl">→</span>
            <div className="flex flex-col gap-2">
              <div className="glass-card p-3 border-emerald-500/30">
                <p className="text-xs font-mono text-emerald-400">✅ PASS → Execute</p>
              </div>
              <div className="glass-card p-3 border-red-500/30">
                <p className="text-xs font-mono text-red-400">❌ FAIL → Revert</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gas Benchmark */}
        <div className="glass-card border-gradient p-6 mt-6">
          <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">
            Gas Benchmark — Stylus vs Solidity
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-xs text-slate-600 uppercase">Array Size</th>
                  <th className="text-right py-2 px-3 text-xs text-slate-600 uppercase">Solidity (EVM)</th>
                  <th className="text-right py-2 px-3 text-xs text-slate-600 uppercase">Stylus (WASM)</th>
                  <th className="text-right py-2 px-3 text-xs text-slate-600 uppercase">Savings</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                  <td className="py-2.5 px-3 text-slate-400">50 prices</td>
                  <td className="py-2.5 px-3 text-right text-red-400">142,160 gas</td>
                  <td className="py-2.5 px-3 text-right text-cyan-400">~14,200 gas</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">~90%</td>
                </tr>
                <tr className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                  <td className="py-2.5 px-3 text-slate-400">100 prices</td>
                  <td className="py-2.5 px-3 text-right text-red-400">211,246 gas</td>
                  <td className="py-2.5 px-3 text-right text-cyan-400">~21,100 gas</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">~90%</td>
                </tr>
                <tr className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-2.5 px-3 text-slate-400">200 prices</td>
                  <td className="py-2.5 px-3 text-right text-red-400">349,673 gas</td>
                  <td className="py-2.5 px-3 text-right text-cyan-400">~35,000 gas</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">~90%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-600 mt-3">
            Solidity gas measured via Foundry. Stylus estimates based on documented 10× compute savings.
            Final WASM benchmarks will be run on Robinhood Chain testnet.
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-12 pb-8 text-center">
          <p className="text-xs text-slate-700 font-mono">
            AegisVault • Arbitrum Open House London 2026 • Robinhood Chain
          </p>
          <p className="text-[10px] text-slate-800 mt-1 italic">
            &quot;We let the AI trade, but we let Rust do the math.&quot;
          </p>
        </footer>
      </main>
    </div>
  );
}
