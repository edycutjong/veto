"use client";

import { useState, useCallback, useEffect, Fragment } from "react";
import Link from "next/link";

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
  riskEngineAddress?: string;
  rpcUrl: string;
  error?: string;
}

// ─── Components ───────────────────────────────────────────────

function StatusBadge({ status }: { status: "blocked" | "executed" | "pending" }) {
  const map = {
    blocked:  { dot: "bg-red-500",              text: "text-red-400",   label: "BLOCKED"  },
    executed: { dot: "bg-cyan-500",              text: "text-cyan-400",  label: "EXECUTED" },
    pending:  { dot: "bg-amber-500 animate-pulse", text: "text-amber-400", label: "PENDING"  },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-widest ${map.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${map.dot}`} />
      {map.label}
    </span>
  );
}

function SparkLine({ prices, blocked }: { prices: number[]; blocked: boolean }) {
  if (!prices?.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 80, H = 28, P = 2;
  const pts = prices
    .map((p, i) => `${P + (i / (prices.length - 1)) * (W - P * 2)},${H - P - ((p - min) / range) * (H - P * 2)}`)
    .join(" ");
  const color = blocked ? "#ef4444" : "#06b6d4";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-16 h-7 shrink-0" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TradeRow({
  trade,
  onShowAlert,
}: {
  trade: TradeAttempt;
  onShowAlert?: (trade: TradeAttempt) => void;
}) {
  const isBlocked = trade.status === "blocked";
  const pctUsed = Math.min(100, (trade.varianceBps / trade.thresholdBps) * 100);

  return (
    <div
      onClick={() => isBlocked && onShowAlert?.(trade)}
      className={`px-5 py-4 border-b border-slate-800/50 last:border-0 transition-colors ${
        isBlocked
          ? "cursor-pointer hover:bg-red-500/5 flash-red"
          : "hover:bg-slate-800/20"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Asset + status */}
          <div className="flex items-center gap-3 mb-2.5">
            <StatusBadge status={trade.status} />
            <span className="font-mono font-bold text-slate-100 text-sm tracking-wide">{trade.asset}</span>
            <span className="text-xs text-slate-500 font-mono">{trade.value}</span>
          </div>

          {/* Variance bar */}
          <div className="flex items-center gap-3">
            <div className="w-32 h-px rounded-full bg-slate-800">
              <div
                className={`h-px rounded-full ${isBlocked ? "bg-red-500" : "bg-cyan-500"}`}
                style={{ width: `${pctUsed}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono tabular-nums ${isBlocked ? "text-red-400" : "text-cyan-400"}`}>
              {trade.varianceBps.toLocaleString()}
              <span className="text-slate-700"> / {trade.thresholdBps} bps</span>
            </span>
          </div>

          {/* Error or TX */}
          {isBlocked && (
            <p className="mt-2 text-[10px] font-mono text-red-500/60">
              VolatilityExceedsThreshold({trade.varianceBps}, {trade.thresholdBps})
              {trade.txHash && (
                <a
                  href={`https://sepolia.arbiscan.io/tx/${trade.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-3 text-slate-700 hover:text-cyan-400 transition-colors"
                >
                  {trade.txHash.slice(0, 12)}… ↗
                </a>
              )}
            </p>
          )}
          {!isBlocked && trade.txHash && (
            <a
              href={`https://sepolia.arbiscan.io/tx/${trade.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-block text-[10px] font-mono text-slate-700 hover:text-cyan-400 transition-colors"
            >
              {trade.txHash.slice(0, 12)}… ↗
            </a>
          )}
        </div>

        {/* Time + sparkline */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-slate-600 tabular-nums">
            {new Date(trade.timestamp).toLocaleTimeString()}
          </span>
          <SparkLine prices={trade.prices} blocked={isBlocked} />
        </div>
      </div>
    </div>
  );
}

function AgentTerminal({ trades }: { trades: TradeAttempt[] }) {
  const lines: Array<{ text: string; type: "cmd" | "info" | "warn" | "error" | "success" }> = [
    { text: "$ veto-agent --mode live --monitor", type: "cmd" },
    { text: "[Agent] Connected to RPC. Synchronizing contract states...", type: "info" },
  ];

  trades.forEach((trade) => {
    if (trade.status === "blocked") {
      lines.push(
        { text: `[Agent] Anomaly: ${trade.asset} shows high-yield activity`, type: "warn" },
        { text: `[Agent] Attempting swap for ${trade.asset}`, type: "warn" },
        { text: `[Agent] ${trade.prices.length} prices fetched. Submitting tx...`, type: "info" },
        { text: `[RiskEngine] Variance: ${trade.varianceBps} bps | Limit: ${trade.thresholdBps} bps`, type: "info" },
        { text: `[REVERT] VolatilityExceedsThreshold(${trade.varianceBps}, ${trade.thresholdBps})`, type: "error" },
        { text: `[BLOCKED] TX: ${trade.txHash.slice(0, 18)}...`, type: "error" }
      );
    } else {
      lines.push(
        { text: `[Agent] Stable yield: ${trade.asset}`, type: "info" },
        { text: `[Agent] Allocating capital to staking vault`, type: "info" },
        { text: `[Agent] ${trade.prices.length} prices fetched. Submitting tx...`, type: "info" },
        { text: `[RiskEngine] Variance: ${trade.varianceBps} bps | Limit: ${trade.thresholdBps} bps`, type: "info" },
        { text: `[PASS] Trade approved and executed`, type: "success" },
        { text: `[EXEC] TX: ${trade.txHash.slice(0, 18)}...`, type: "success" }
      );
    }
  });

  const colors: Record<string, string> = {
    cmd:     "text-cyan-400",
    info:    "text-slate-500",
    warn:    "text-amber-400",
    error:   "text-red-400",
    success: "text-cyan-400",
  };

  return (
    <div className="h-full flex flex-col">
      {/* Terminal chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/40 shrink-0">
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
        </div>
        <span className="text-[10px] font-mono text-slate-600 flex-1 ml-1">agent@veto ~ python agent.py</span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[10px] font-mono text-slate-600">LIVE</span>
        </div>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
        {lines.map((line, i) => (
          <p key={i} className={`text-[11px] font-mono leading-relaxed ${colors[line.type]}`}>
            {line.text}
          </p>
        ))}
        <p className="text-[11px] font-mono text-cyan-400 animate-pulse mt-1">▌</p>
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
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedModalData, setBlockedModalData] = useState<{
    computed: number;
    limit: number;
    asset: string;
    value: string;
    timestamp: string;
    txHash: string;
  } | null>(null);

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
      const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;
      const url = agentUrl ? `${agentUrl}/api/trades` : "/trades.json";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const sorted = [...data].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setTrades(sorted);
      }
    } catch (e) {
      console.error("Failed to fetch trades log:", e);
    }
  }, []);

  useEffect(() => {
    const initTimeout = setTimeout(() => {
      fetchVaultData();
      fetchTradesData();
    }, 0);
    const statsInterval = setInterval(fetchVaultData, 5000);
    const tradesInterval = setInterval(fetchTradesData, 5000);
    return () => {
      clearTimeout(initTimeout);
      clearInterval(statsInterval);
      clearInterval(tradesInterval);
    };
  }, [fetchVaultData, fetchTradesData]);

  const handleSimulateBlock = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);

    const txHash =
      "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const mockTrade: TradeAttempt = {
      id: Date.now(),
      asset: "RUGCOIN",
      status: "blocked",
      varianceBps: 2450,
      thresholdBps: vaultStats.threshold,
      value: "2.50 ETH",
      timestamp: new Date().toISOString(),
      prices: [1200, 1250, 1100, 950, 800, 750, 680, 590, 520, 480],
      txHash,
    };

    setTrades((prev) => [mockTrade, ...prev]);
    setBlockedModalData({
      computed: 2450,
      limit: vaultStats.threshold,
      asset: "RUGCOIN",
      value: "2.50 ETH",
      timestamp: mockTrade.timestamp,
      txHash,
    });
    setShowBlockedModal(true);
  }, [vaultStats.threshold]);

  const blockedCount = trades.filter((t) => t.status === "blocked").length;

  const stats = [
    { label: "Vault Balance",      value: `${vaultStats.balance} ETH`, sub: "RPC live state",    color: "text-cyan-400"  },
    { label: "Trades Executed",    value: vaultStats.executed,          sub: "Within threshold",   color: "text-cyan-400"  },
    { label: "Trades Blocked",     value: blockedCount,                  sub: "Variance exceeded",  color: "text-red-400"   },
    { label: "Capital Protected",  value: `${(blockedCount * 2.0).toFixed(1)} ETH`, sub: "Est. from blocks", color: "text-amber-400" },
  ];

  const archNodes = [
    { label: "AI Agent",     tech: "Python / web3.py", color: "text-amber-400", highlight: false },
    { label: "Vault",        tech: "Solidity / EVM",   color: "text-cyan-400",  highlight: false },
    { label: "Risk Engine",  tech: "Rust / WASM",      color: "text-cyan-400",  highlight: true  },
  ];

  const gasBenchmark = [
    ["50 prices",  "142,160", "~14,200", "~90%"],
    ["100 prices", "211,246", "~21,100", "~90%"],
    ["200 prices", "349,673", "~35,000", "~90%"],
  ];

  return (
    <div className={`scanline min-h-screen bg-slate-950 ${shaking ? "shake" : ""}`}>

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-14 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-screen-xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative shrink-0">
                <div className="absolute inset-0.5 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-xl blur-sm opacity-40 group-hover:opacity-80 transition-opacity duration-300 animate-pulse" />
                <div className="relative w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-cyan-500/50 flex items-center justify-center shadow-lg shadow-cyan-500/20 hover:scale-105 transition-all duration-300">
                  <svg className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <div>
                <span className="font-mono font-black text-slate-100 text-sm tracking-widest">VETO</span>
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-wider leading-none mt-0.5">Risk Engine</p>
              </div>
            </Link>

            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-600">
              <span>Security Console</span>
              <span className="text-slate-800">/</span>
              <span className="text-slate-400">Live Monitor</span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot-live" />
              <span className="text-xs font-mono text-cyan-400 font-bold tracking-wider">LIVE</span>
            </div>

            {vaultStats.vaultAddress && (
              <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-slate-700">
                <span>Vault</span>
                <span className="text-slate-500 select-all">
                  {vaultStats.vaultAddress.slice(0, 6)}…{vaultStats.vaultAddress.slice(-4)}
                </span>
              </div>
            )}

            <Link
              href="/"
              className="hidden sm:flex items-center gap-1 text-xs font-mono text-slate-500 hover:text-cyan-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6">

        {/* ── Stats + Controls ────────────────────────────── */}
        <div className="py-6 border-b border-slate-800/50">
          <div className="flex flex-wrap items-end gap-8">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 flex-1 min-w-0">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-600 mb-1.5">{s.label}</p>
                  <p className={`text-2xl font-mono font-bold tabular-nums leading-none ${s.color}`}>
                    {s.value}
                  </p>
                  <p className="text-[10px] text-slate-700 mt-1 font-mono">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px h-14 bg-slate-800 self-center" />

            {/* Threshold + Simulate */}
            <div className="flex items-center gap-6 shrink-0">
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-600 mb-1.5">Risk Threshold</p>
                <div className="flex items-center gap-3">
                  <div className="w-28 h-px rounded-full bg-slate-800">
                    <div
                      className="h-px rounded-full bg-cyan-500 transition-all duration-500"
                      style={{ width: `${(vaultStats.threshold / 5000) * 100}%` }}
                    />
                  </div>
                  <span className="text-2xl font-mono font-bold text-cyan-400 tabular-nums leading-none">
                    {vaultStats.threshold}
                  </span>
                  <span className="text-xs font-mono text-slate-600">bps</span>
                </div>
                <p className="text-[10px] text-slate-700 mt-1 font-mono">
                  {(vaultStats.threshold / 100).toFixed(1)}% max variance
                </p>
              </div>

              <button
                onClick={handleSimulateBlock}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors text-xs font-mono shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Simulate Block
              </button>
            </div>
          </div>
        </div>

        {/* ── Trade Log + Terminal ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-6 py-6 border-b border-slate-800/50">

          {/* Trade Activity */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Trade Activity
              </h2>
              <span className="text-[10px] font-mono text-slate-700">{trades.length} events</span>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/50">
              {trades.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-slate-700 font-mono">Waiting for agent trade proposals…</p>
                </div>
              ) : (
                trades.map((trade) => (
                  <TradeRow
                    key={trade.id}
                    trade={trade}
                    onShowAlert={(t) => {
                      setBlockedModalData({
                        computed: t.varianceBps,
                        limit: t.thresholdBps,
                        asset: t.asset,
                        value: t.value,
                        timestamp: t.timestamp,
                        txHash: t.txHash,
                      });
                      setShowBlockedModal(true);
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Agent Terminal */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-glow" />
                Agent Output
              </h2>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden" style={{ height: 480 }}>
              <AgentTerminal trades={trades} />
            </div>
          </div>
        </div>

        {/* ── Architecture + Gas ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/50 py-6">

          {/* Architecture */}
          <div className="lg:pr-8">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-5">Architecture</h2>
            <div className="flex flex-wrap items-center gap-3">
              {archNodes.map((node, i) => (
                <Fragment key={node.label}>
                  <div
                    className={`flex flex-col gap-0.5 px-4 py-3 rounded-lg border ${
                      node.highlight
                        ? "border-cyan-500/20 bg-cyan-500/5"
                        : "border-slate-800 bg-slate-900/40"
                    }`}
                  >
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-600">
                      {node.label}
                    </span>
                    <span className={`text-sm font-mono font-bold ${node.color}`}>{node.tech}</span>
                  </div>
                  {i < archNodes.length - 1 && (
                    <svg className="w-4 h-4 text-slate-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </Fragment>
              ))}

              <svg className="w-4 h-4 text-slate-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-cyan-500/20 bg-cyan-500/5">
                  <svg className="w-3 h-3 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[10px] font-mono text-cyan-400">PASS → Execute</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-500/20 bg-red-500/5">
                  <svg className="w-3 h-3 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-[10px] font-mono text-red-400">FAIL → Revert</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gas Benchmark */}
          <div className="lg:pl-8 pt-6 lg:pt-0">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-5">
              Gas Benchmark — Stylus vs Solidity
            </h2>
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800/60">
                  <th className="text-left pb-2.5 font-normal text-slate-600">Array</th>
                  <th className="text-right pb-2.5 font-normal text-slate-600">Solidity</th>
                  <th className="text-right pb-2.5 font-normal text-slate-600">Stylus (WASM)</th>
                  <th className="text-right pb-2.5 font-normal text-slate-600">Savings</th>
                </tr>
              </thead>
              <tbody>
                {gasBenchmark.map(([size, sol, stylus, savings]) => (
                  <tr key={size} className="border-b border-slate-800/30 last:border-0">
                    <td className="py-2.5 text-slate-500">{size}</td>
                    <td className="py-2.5 text-right text-red-400/70 tabular-nums">{sol}</td>
                    <td className="py-2.5 text-right text-cyan-400/70 tabular-nums">{stylus}</td>
                    <td className="py-2.5 text-right text-cyan-400 font-bold">{savings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[9px] text-slate-700 mt-3 leading-relaxed font-mono">
              Solidity gas via Foundry. Stylus estimates based on documented 10× compute savings on Robinhood Chain.
            </p>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <footer className="py-5 border-t border-slate-800/50 flex items-center justify-between">
          <p className="text-[10px] font-mono text-slate-700">
            Veto · Arbitrum Open House London 2026 · Robinhood Chain
          </p>
          <p className="text-[10px] font-mono text-slate-800 italic hidden sm:block">
            &quot;Your AI tried. Veto said no.&quot;
          </p>
        </footer>
      </div>

      {/* ── Blocked Modal ────────────────────────────────────── */}
      {showBlockedModal && blockedModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md mx-4 bg-slate-900 border border-red-500/25 rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden animate-fade-in-up">
            {/* Red accent bar */}
            <div className="h-0.5 w-full bg-red-500/60" />

            <div className="p-6">
              {/* Title */}
              <div className="flex items-center gap-3 mb-5">
                <div className="relative shrink-0">
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
                  <div className="relative w-9 h-9 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-mono font-bold text-red-400 uppercase tracking-widest">
                    Veto Intercept
                  </h3>
                  <p className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mt-0.5">
                    Transaction Reverted On-Chain
                  </p>
                </div>
              </div>

              {/* Error code */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-5 font-mono text-xs">
                <span className="text-red-400">VolatilityExceedsThreshold</span>
                <span className="text-slate-400">({blockedModalData.computed}, {blockedModalData.limit})</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <p className="text-[8px] font-mono uppercase tracking-widest text-slate-600 mb-1.5">
                    Computed Variance
                  </p>
                  <p className="text-2xl font-mono font-bold text-red-400 tabular-nums leading-none">
                    {blockedModalData.computed}
                  </p>
                  <p className="text-[9px] font-mono text-slate-700 mt-1">basis points</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <p className="text-[8px] font-mono uppercase tracking-widest text-slate-600 mb-1.5">
                    Threshold Limit
                  </p>
                  <p className="text-2xl font-mono font-bold text-slate-300 tabular-nums leading-none">
                    {blockedModalData.limit}
                  </p>
                  <p className="text-[9px] font-mono text-slate-700 mt-1">basis points</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed mb-4 font-mono">
                Trade for{" "}
                <span className="text-slate-200 font-bold">{blockedModalData.asset}</span>{" "}
                ({blockedModalData.value}) intercepted. Variance{" "}
                <span className="text-red-400">{blockedModalData.computed} bps</span> exceeds the{" "}
                <span className="text-slate-300">{(blockedModalData.limit / 100).toFixed(1)}%</span> limit.
                Capital remains in VetoVault.
              </p>

              {/* TX hash */}
              <div className="font-mono text-[10px] text-slate-700 bg-slate-950/40 border border-slate-800/50 rounded-lg p-3 mb-5 break-all select-all">
                {blockedModalData.txHash}
              </div>

              <button
                onClick={() => {
                  setShowBlockedModal(false);
                  setBlockedModalData(null);
                }}
                className="w-full py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors font-mono text-xs tracking-wider"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
