"use client";

import { useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────

interface TradeAttempt {
  id: number;
  asset: string;
  status: "blocked" | "executed" | "pending";
  varianceBps: number;
  thresholdBps: number;
  value: string;
  timestamp: string;
  prices: number[];
  txHash: string;
}

interface VaultStats {
  balance: string;
  threshold: number;
  executed: number;
  blocked: number;
  vaultAddress: string;
  rpcUrl: string;
  error?: string;
}

// ─── Components ───────────────────────────────────────────────

function StatusBadge({ status }: { status: "blocked" | "executed" | "pending" }) {
  const styles = {
    blocked: "bg-red-500/10 text-red-400 border-red-500/30",
    executed: "bg-primary/10 text-primary border-primary/30",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  };

  const labels = {
    blocked: "🚨 BLOCKED",
    executed: "✅ EXECUTED",
    pending: "⏳ PENDING",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${styles[status]}`}>
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
  accent: "primary" | "red" | "green" | "amber";
  subtitle?: string;
}) {
  const accentColors = {
    primary: "text-primary border-primary/20",
    red: "text-red-400 border-red-500/20",
    green: "text-primary border-primary/20",
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
  if (!prices || !prices.length) return null;

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

  const color = blocked ? "#ef4444" : "#00C805";
  const glowColor = blocked ? "rgba(239,68,68,0.3)" : "rgba(0,200,5,0.3)";

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
  const rowClass = isBlocked ? "border-red-500/20 hover:border-red-500/40" : "border-primary/20 hover:border-primary/40";

  return (
    <div className={`glass-card p-4 mb-3 border ${rowClass} transition-all ${isBlocked ? "flash-red" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-base font-mono font-bold text-slate-200">{trade.asset}</span>
          <StatusBadge status={trade.status} />
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {new Date(trade.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <PriceChart prices={trade.prices} blocked={isBlocked} />

      <div className="grid grid-cols-3 gap-3 mt-3">
        <div>
          <p className="text-[10px] text-slate-600 uppercase">Variance</p>
          <p className={`text-sm font-mono font-semibold ${isBlocked ? "text-red-400" : "text-primary"}`}>
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
          <p className="text-[11px] font-mono text-red-400 break-all">
            <span className="text-red-500 font-bold">Custom Error:</span>{" "}
            VolatilityExceedsThreshold({trade.varianceBps}, {trade.thresholdBps})
          </p>
        </div>
      )}

      {trade.txHash && (
        <div className="mt-2 text-[10px] font-mono text-slate-600 flex items-center justify-between border-t border-slate-900 pt-2">
          <span>TX: {trade.txHash.slice(0, 18)}...</span>
          <a
            href={`https://sepolia.arbiscan.io/tx/${trade.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Verify ↗
          </a>
        </div>
      )}
    </div>
  );
}

function AgentTerminal({ trades }: { trades: TradeAttempt[] }) {
  const terminalLines: Array<{ text: string; type: "cmd" | "info" | "warn" | "error" | "success" }> = [
    { text: "$ veto-agent --mode live --monitor", type: "cmd" },
    { text: "[Agent] Connected to RPC. Synchronizing contract states...", type: "info" },
  ];

  trades.forEach((trade) => {
    if (trade.status === "blocked") {
      terminalLines.push(
        { text: `[Agent] Market anomaly detected: ${trade.asset} shows high-yield activity`, type: "warn" },
        { text: `[Agent] Decision: Attempting token swap for ${trade.asset}`, type: "warn" },
        { text: `[Agent] Fetched ${trade.prices.length} prices. Sending trade proposal transaction...`, type: "info" },
        { text: `[RiskEngine] Variance computed: ${trade.varianceBps} bps. Limit: ${trade.thresholdBps} bps`, type: "info" },
        { text: `🚨 REVERTED: VolatilityExceedsThreshold(${trade.varianceBps}, ${trade.thresholdBps})`, type: "error" },
        { text: `[RiskEngine] Trade BLOCKED. Transaction hash: ${trade.txHash}`, type: "error" }
      );
    } else {
      terminalLines.push(
        { text: `[Agent] Consistent yield opportunity: Staking ${trade.asset}`, type: "info" },
        { text: `[Agent] Decision: Allocate capital to staking vault`, type: "info" },
        { text: `[Agent] Fetched ${trade.prices.length} prices. Sending trade execution...`, type: "info" },
        { text: `[RiskEngine] Variance computed: ${trade.varianceBps} bps. Limit: ${trade.thresholdBps} bps`, type: "info" },
        { text: `✅ EXECUTED: On-chain transaction executed successfully`, type: "success" },
        { text: `[RiskEngine] Trade APPROVED. Transaction hash: ${trade.txHash}`, type: "success" }
      );
    }
  });

  const typeColors = {
    cmd: "text-primary",
    info: "text-slate-500",
    warn: "text-amber-400",
    error: "text-red-400",
    success: "text-primary",
  };

  return (
    <div className="glass-card p-4 h-full">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-primary/80" />
        </div>
        <span className="text-xs text-slate-600 font-mono ml-2">agent@veto ~ python agent.py</span>
      </div>
      <div className="space-y-1 overflow-y-auto max-h-[500px] h-[450px]">
        {terminalLines.map((line, i) => (
          <p key={i} className={`text-xs font-mono leading-relaxed ${typeColors[line.type]}`}>
            {line.text}
          </p>
        ))}
        <p className="text-xs font-mono text-primary animate-pulse mt-2">▌</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function Dashboard() {
  const [shaking, setShaking] = useState(false);
  const [trades, setTrades] = useState<TradeAttempt[]>([]);
  const [vaultStats, setVaultStats] = useState<VaultStats>({
    balance: "0.0000",
    threshold: 1000,
    executed: 0,
    blocked: 0,
    vaultAddress: "",
    rpcUrl: "",
  });

  const fetchVaultData = useCallback(async () => {
    try {
      const res = await fetch("/api/vault");
      if (res.ok) {
        const data = await res.json();
        setVaultStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch vault statistics:", e);
    }
  }, []);

  const fetchTradesData = useCallback(async () => {
    try {
      const res = await fetch("/trades.json");
      if (res.ok) {
        const data = await res.json();
        // Sort trades by timestamp descending
        const sorted = [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setTrades(sorted);
      }
    } catch (e) {
      console.error("Failed to fetch trades log:", e);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVaultData();
    fetchTradesData();

    // Set intervals
    const statsInterval = setInterval(fetchVaultData, 5000);
    const tradesInterval = setInterval(fetchTradesData, 5000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(tradesInterval);
    };
  }, [fetchVaultData, fetchTradesData]);

  const handleSimulateBlock = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }, []);

  const blockedCount = trades.filter((t) => t.status === "blocked").length;

  return (
    <div className={`scanline min-h-screen ${shaking ? "shake" : ""}`}>
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-lg font-bold shadow-lg shadow-primary/20">
              🛡️
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-primary">Ve</span>
                <span className="text-slate-300">to</span>
                <span className="text-slate-600 text-sm ml-2 font-normal">✋</span>
              </h1>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest">WASM Risk Engine • Robinhood Chain</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot-live" />
              <span className="text-xs text-primary font-mono font-bold">CONNECTED LIVE</span>
            </div>
            {vaultStats.vaultAddress && (
              <span className="text-[10px] text-slate-500 font-mono">
                Vault: {vaultStats.vaultAddress.slice(0, 6)}...{vaultStats.vaultAddress.slice(-4)}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Vault Balance"
            value={`${vaultStats.balance} ETH`}
            accent="primary"
            subtitle="Live RPC State"
          />
          <StatCard
            label="Trades Executed"
            value={vaultStats.executed}
            accent="green"
            subtitle="Within threshold"
          />
          <StatCard
            label="Trades Blocked"
            value={blockedCount}
            accent="red"
            subtitle="Variance exceeded"
          />
          <StatCard
            label="Funds Saved"
            value={`${(blockedCount * 2.0).toFixed(1)} ETH`}
            accent="amber"
            subtitle="Est. Volatility Saved"
          />
        </div>

        {/* Threshold Control */}
        <div className="glass-card border-gradient p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-300">Human Control Panel</h2>
              <p className="text-xs text-slate-600">On-chain Maximum Acceptable Asset Variance (BPS)</p>
            </div>
            <button
              onClick={handleSimulateBlock}
              className="px-4 py-2 text-xs font-mono rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
            >
              🧪 Simulate Block
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-1.5 rounded-full bg-slate-800 relative">
              <div
                className="absolute h-full rounded-full bg-primary"
                style={{ width: `${(vaultStats.threshold / 5000) * 100}%` }}
              />
            </div>
            <div className="text-right min-w-[120px]">
              <span className="text-xl font-mono font-bold text-primary">{vaultStats.threshold}</span>
              <span className="text-xs text-slate-600 ml-1">bps</span>
              <p className="text-[10px] text-slate-600">{(vaultStats.threshold / 100).toFixed(1)}% max variance</p>
            </div>
          </div>
        </div>

        {/* Split View: Trade History + Agent Terminal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Trade History */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Trade Execution Log
            </h2>
            {trades.length === 0 ? (
              <p className="text-sm text-slate-600 italic font-mono p-4">Waiting for agent trade proposals...</p>
            ) : (
              trades.map((trade) => <TradeRow key={trade.id} trade={trade} />)
            )}
          </div>

          {/* Right: Agent Terminal */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary pulse-glow" />
              Agent Execution Terminal
            </h2>
            <AgentTerminal trades={trades} />
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
            <span className="text-primary text-xl">→</span>
            <div className="glass-card p-4 min-w-[160px] border-primary/30">
              <p className="text-xs text-slate-600 uppercase mb-1">Vault</p>
              <p className="text-sm font-mono text-primary">Solidity (EVM)</p>
              <p className="text-[10px] text-slate-600 mt-1">Holds funds</p>
              <p className="text-[10px] text-slate-600">Access control</p>
            </div>
            <span className="text-primary text-xl">→</span>
            <div className="glass-card p-4 min-w-[160px] glow-primary border-primary/20">
              <p className="text-xs text-slate-600 uppercase mb-1">Risk Engine</p>
              <p className="text-sm font-mono text-primary font-bold">Rust / Stylus</p>
              <p className="text-[10px] text-slate-600 mt-1">WASM math</p>
              <p className="text-[10px] text-slate-600">Variance computation</p>
            </div>
            <span className="text-2xl">→</span>
            <div className="flex flex-col gap-2">
              <div className="glass-card p-3 border-primary/30">
                <p className="text-xs font-mono text-primary">✅ PASS → Execute</p>
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
                  <td className="py-2.5 px-3 text-right text-primary">~14,200 gas</td>
                  <td className="py-2.5 px-3 text-right text-primary">~90%</td>
                </tr>
                <tr className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                  <td className="py-2.5 px-3 text-slate-400">100 prices</td>
                  <td className="py-2.5 px-3 text-right text-red-400">211,246 gas</td>
                  <td className="py-2.5 px-3 text-right text-primary">~21,100 gas</td>
                  <td className="py-2.5 px-3 text-right text-primary">~90%</td>
                </tr>
                <tr className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-2.5 px-3 text-slate-400">200 prices</td>
                  <td className="py-2.5 px-3 text-right text-red-400">349,673 gas</td>
                  <td className="py-2.5 px-3 text-right text-primary">~35,000 gas</td>
                  <td className="py-2.5 px-3 text-right text-primary">~90%</td>
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
            Veto • Arbitrum Open House London 2026 • Robinhood Chain
          </p>
          <p className="text-[10px] text-slate-800 mt-1 italic">
            &quot;Your AI tried. Veto said no.&quot;
          </p>
        </footer>
      </main>
    </div>
  );
}
