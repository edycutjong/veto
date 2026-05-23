"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Canvas Background ────────────────────────────────────────────

function CanvasBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const mouseRef = React.useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    class Particle {
      x: number; y: number; vx: number; vy: number; radius: number;
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = (Math.random() - 0.5) * 0.25;
        this.radius = Math.random() * 1.2 + 0.4;
      }
      update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > width) this.vx = -this.vx;
        if (this.y < 0 || this.y > height) this.vy = -this.vy;
      }
      draw(c: CanvasRenderingContext2D) {
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        c.fillStyle = "rgba(6, 182, 212, 0.35)";
        c.fill();
      }
    }

    const count = Math.min(Math.floor((width * height) / 14000), 90);
    const particles: Particle[] = Array.from({ length: count }, () => new Particle());

    const onMouseMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY, active: true }; };
    const onMouseLeave = () => { mouseRef.current.active = false; };
    window.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("mouseleave", onMouseLeave);

    const drawGrid = (c: CanvasRenderingContext2D) => {
      c.strokeStyle = "rgba(6, 182, 212, 0.018)";
      c.lineWidth = 0.5;
      for (let x = 0; x < width; x += 48) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, height); c.stroke(); }
      for (let y = 0; y < height; y += 48) { c.beginPath(); c.moveTo(0, y); c.lineTo(width, y); c.stroke(); }
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      drawGrid(ctx);
      particles.forEach((p) => { p.update(); p.draw(ctx); });
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(6, 182, 212, ${(1 - dist / 110) * 0.12})`;
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke();
          }
        }
        if (mouseRef.current.active) {
          const mdx = particles[i].x - mouseRef.current.x;
          const mdy = particles[i].y - mouseRef.current.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < 160) {
            ctx.strokeStyle = `rgba(6, 182, 212, ${(1 - mdist / 160) * 0.22})`;
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(mouseRef.current.x, mouseRef.current.y); ctx.stroke();
          }
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("mouseleave", onMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

// ─── Shield Icon ─────────────────────────────────────────────────

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function getLogClass(log: string): string {
  if (log.startsWith("$")) {
    return "text-primary";
  } else if (log.includes("[VETO]") && log.includes("REVERTED")) {
    return "text-red-400 font-semibold";
  } else if (log.includes("[VETO]") && log.includes("APPROVED")) {
    return "text-primary font-semibold";
  } else if (log.includes("RISK:")) {
    return "text-red-400";
  } else if (log.includes("SAFE:")) {
    return "text-primary";
  } else if (log.includes("[WASM]")) {
    return "text-amber-400/80";
  } else if (log.includes("[Vault]")) {
    return "text-cyan-400";
  } else if (log.includes("[Veto]")) {
    return "text-slate-300";
  } else {
    return "text-slate-500";
  }
}

// ─── Main Landing Page ────────────────────────────────────────────

export default function LandingPage() {
  const [selectedAsset, setSelectedAsset] = useState<"RUGCOIN" | "ETH">("RUGCOIN");
  const [simState, setSimState] = useState<"idle" | "sending" | "evaluating" | "result">("idle");
  const [simResult, setSimResult] = useState<"blocked" | "executed" | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  const startSimulation = useCallback(() => {
    setSimState("sending");
    setSimResult(null);
    setTerminalLogs([`$ veto-agent --mode dry-run --asset ${selectedAsset}`]);

    const steps = [
      {
        delay: 600,
        action: () => setTerminalLogs((p) => [...p,
          `[Agent] Market opportunity detected: ${selectedAsset}`,
          `[Agent] Building calldata payload with 50-point price array...`,
        ]),
      },
      {
        delay: 1400,
        action: () => {
          setSimState("evaluating");
          setTerminalLogs((p) => [...p,
            `[Veto]  Transaction intercepted by WASM Risk Sandbox`,
            `[WASM]  Loading Stylus risk engine on Robinhood Chain...`,
            `[WASM]  Computing O(N) variance over price calldata...`,
          ]);
        },
      },
      {
        delay: 2400,
        action: () => {
          setSimState("result");
          if (selectedAsset === "RUGCOIN") {
            setSimResult("blocked");
            setShowBlockedModal(true);
            setTerminalLogs((p) => [...p,
              `[WASM]  variance = 2,450 BPS  |  threshold = 1,000 BPS`,
              `[WASM]  RISK: Volatility exceeds absolute safety limit`,
              `[VETO]  REVERTED: VolatilityExceedsThreshold(2450, 1000)`,
              `[Vault] Capital protected. No funds moved.`,
            ]);
          } else {
            setSimResult("executed");
            setTerminalLogs((p) => [...p,
              `[WASM]  variance = 120 BPS  |  threshold = 1,000 BPS`,
              `[WASM]  SAFE: Variance within acceptable parameters`,
              `[VETO]  APPROVED: Forwarding to VetoVault`,
              `[Vault] Swap executed. TX: 0x8dfb2a4c...ce32`,
            ]);
          }
        },
      },
    ];

    steps.forEach((s) => setTimeout(s.action, s.delay));
  }, [selectedAsset]);

  const isRunning = simState === "sending" || simState === "evaluating";

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden font-sans bg-slate-950 scanline">
      <CanvasBackground />

      {/* ── Sticky Navigation ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-900/80 bg-slate-950/85 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">

          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <img src="/icon.svg" alt="Veto" className="w-8 h-8" />
            <span className="font-display text-base font-black tracking-widest">
              <span className="text-primary">VE</span><span className="text-danger">TO</span>
            </span>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[8px] font-bold bg-primary/10 text-primary border border-primary/25 tracking-widest uppercase font-mono">
              LIVE
            </span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: "#how-it-works", label: "How it Works" },
              { href: "#sandbox", label: "Sandbox" },
              { href: "#contracts", label: "Contracts" },
            ].map(({ href, label }) => (
              <a key={href} href={href} className="text-[11px] text-slate-500 hover:text-slate-200 transition-colors font-mono uppercase tracking-widest">
                {label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-slate-950 text-[11px] font-display font-black tracking-wider hover:shadow-lg hover:shadow-primary/30 transition-all hover:scale-[1.02] shrink-0"
          >
            Enter Console
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </Link>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-6 pt-20 pb-20 grow grid grid-cols-1 lg:grid-cols-2 gap-16 xl:gap-24 items-center">

        {/* Left: Copy */}
        <section className="flex flex-col items-start animate-fade-in-up">

          {/* Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
              Arbitrum Open House London 2026
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-sans font-black leading-[1.05] mb-7 tracking-tight">
            <span className="block text-slate-500 text-xl sm:text-2xl font-normal tracking-normal mb-4 leading-snug">
              Your AI agent tried to<br className="hidden sm:block" /> execute a volatile trade.
            </span>
            <span className="block font-display text-5xl sm:text-6xl lg:text-7xl tracking-tighter bg-linear-to-br from-red-400 via-orange-300 to-primary bg-clip-text text-transparent drop-shadow-[0_0_50px_rgba(0,200,5,0.15)]">
              Veto Said No.
            </span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-[15px] leading-relaxed mb-10 max-w-lg">
            A hybrid{" "}
            <span className="text-slate-200 font-medium">EVM/WASM execution sandbox</span>{" "}
            on Robinhood Chain. Arbitrum Stylus acts as an on-chain math coprocessor — computing historical asset variance in real-time and physically preventing autonomous trading agents from executing dangerous or hallucinated transactions.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-14 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="relative group overflow-hidden inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-slate-950 font-display font-black text-xs tracking-widest hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-[1.02]"
            >
              <span className="absolute inset-0 bg-white/15 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-xl" />
              <svg className="w-3.5 h-3.5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              <span className="relative z-10">Launch Security Console</span>
            </Link>
            <a
              href="#sandbox"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-slate-700 text-slate-300 font-display font-black text-xs tracking-widest bg-slate-900/40 hover:bg-slate-900/80 hover:border-slate-600 hover:text-white transition-all"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Live Demo
            </a>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-6 sm:gap-10 border-t border-slate-900 pt-8 w-full">
            {[
              { value: "<15ms", label: "Eval Latency", color: "text-white" },
              { value: "~90%", label: "Gas Saved", color: "text-primary" },
              { value: "Zero", label: "Slipped Trades", color: "text-red-400" },
            ].map(({ value, label, color }) => (
              <div key={label}>
                <p className={`font-mono text-2xl font-bold tracking-tight ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-1 font-mono">{label}</p>
              </div>
            ))}
          </div>

          {/* Ecosystem Partners */}
          <div className="flex flex-wrap items-center gap-3 mt-8 pt-6 border-t border-slate-900 w-full animate-fade-in-up delay-100">
            <span className="text-[10px] text-slate-600 font-mono tracking-wider uppercase mr-1">Ecosystem:</span>
            
            {/* Arbitrum */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-900 bg-slate-900/40 hover:border-primary/30 hover:bg-slate-900/80 transition-all duration-200">
              <img src="/icon-arbitrum.svg" alt="Arbitrum" className="w-4 h-4 object-contain" />
              <span className="text-[10px] font-semibold text-slate-400">Arbitrum</span>
            </div>

            {/* Robinhood Chain */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-900 bg-slate-900/40 hover:border-primary/30 hover:bg-slate-900/80 transition-all duration-200">
              <img src="/icon-robinhood-chain.png" alt="Robinhood Chain" className="w-4 h-4 object-contain rounded-full" />
              <span className="text-[10px] font-semibold text-slate-400">Robinhood Chain</span>
            </div>

            {/* HackQuest */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-900 bg-slate-900/40 hover:border-amber-500/30 hover:bg-slate-900/80 transition-all duration-200">
              <img src="/icon-hackquest.png" alt="HackQuest" className="w-4 h-4 object-contain" />
              <span className="text-[10px] font-semibold text-slate-400">HackQuest</span>
            </div>
          </div>
        </section>

        {/* Right: Sandbox */}
        <section id="sandbox" className="glass-card border-gradient p-5 relative animate-fade-in-up delay-200">

          {/* Panel header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/70">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <h3 className="font-display font-bold text-[11px] text-slate-200 tracking-widest uppercase">
                  WASM Risk Sandbox
                </h3>
              </div>
              <p className="text-[10px] text-slate-600 font-mono">Robinhood Chain · Arbitrum Sepolia</p>
            </div>

            <div className="flex gap-2">
              {(["RUGCOIN", "ETH"] as const).map((asset) => (
                <button
                  key={asset}
                  onClick={() => { setSelectedAsset(asset); setSimState("idle"); setSimResult(null); setTerminalLogs([]); }}
                  className={`px-3 py-1 text-[10px] font-mono rounded-lg border transition-all cursor-pointer ${
                    selectedAsset === asset
                      ? asset === "RUGCOIN"
                        ? "bg-red-500/10 text-red-400 border-red-500/30"
                        : "bg-primary/10 text-primary border-primary/30"
                      : "bg-slate-900/80 text-slate-500 border-slate-800 hover:text-slate-300"
                  }`}
                >
                  {asset === "RUGCOIN" ? "⚠ RUGCOIN" : "◆ ETH"}
                </button>
              ))}
            </div>
          </div>

          {/* Flow diagram */}
          <div className="h-36 bg-slate-950/70 border border-slate-900 rounded-xl px-5 flex items-center justify-between mb-5">

            {/* Agent node */}
            <div className="relative flex flex-col items-center">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${
                simState === "sending"
                  ? "border-amber-400/60 bg-amber-400/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                  : "border-slate-800 bg-slate-900/60"
              }`}>
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 text-[9px] font-mono text-slate-600 uppercase tracking-wider whitespace-nowrap">Agent</span>
            </div>

            {/* Wire 1 */}
            <div className="flex-1 h-px bg-slate-800 relative overflow-hidden">
              {simState === "sending" && (
                <div className="absolute top-[-2px] h-[5px] w-5 bg-amber-400/80 rounded-full animate-path-flow" />
              )}
              {(simState === "evaluating" || simState === "result") && (
                <div className={`absolute inset-0 transition-colors duration-500 ${
                  simState === "result" && simResult === "blocked" ? "bg-red-500/25" : "bg-primary/25"
                }`} />
              )}
            </div>

            {/* Veto node */}
            <div className="relative flex flex-col items-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                simState === "evaluating"
                  ? "border-primary/60 bg-primary/10 shadow-[0_0_25px_rgba(0,200,5,0.25)]"
                  : simResult === "blocked"
                    ? "border-red-500/60 bg-red-500/10 shadow-[0_0_25px_rgba(239,68,68,0.3)]"
                    : simResult === "executed"
                      ? "border-primary/60 bg-primary/10 shadow-[0_0_25px_rgba(0,200,5,0.3)]"
                      : "border-slate-700 bg-slate-900/60"
              }`}>
                {simState === "evaluating" ? (
                  <svg className="w-7 h-7 text-primary animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : simResult === "blocked" ? (
                  <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                ) : simResult === "executed" ? (
                  <ShieldIcon className="w-7 h-7 text-primary" />
                ) : (
                  <ShieldIcon className="w-7 h-7 text-slate-600" />
                )}
              </div>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 text-[9px] font-mono text-slate-600 uppercase tracking-wider whitespace-nowrap">Veto</span>
            </div>

            {/* Wire 2 */}
            <div className="flex-1 h-px bg-slate-800 relative overflow-hidden">
              {simResult === "executed" && (
                <div className="absolute inset-0 bg-primary/25 transition-colors duration-500" />
              )}
            </div>

            {/* Vault node */}
            <div className="relative flex flex-col items-center">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${
                simResult === "executed"
                  ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_rgba(0,200,5,0.2)]"
                  : "border-slate-800 bg-slate-900/60"
              }`}>
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 text-[9px] font-mono text-slate-600 uppercase tracking-wider whitespace-nowrap">Vault</span>
            </div>
          </div>

          {/* Result status */}
          {simResult && (
            <div className={`mb-4 px-4 py-2 rounded-lg border text-[11px] font-mono flex items-center gap-2 ${
              simResult === "blocked"
                ? "bg-red-500/8 border-red-500/25 text-red-400"
                : "bg-primary/8 border-primary/25 text-primary"
            }`}>
              {simResult === "blocked"
                ? "✗  REVERTED: VolatilityExceedsThreshold(2450, 1000)"
                : "✓  EXECUTED: Swap confirmed · TX: 0x8dfb2...ce32"}
            </div>
          )}

          {/* Run button */}
          <button
            onClick={startSimulation}
            disabled={isRunning}
            className="w-full py-2.5 mb-4 font-display text-[11px] font-bold tracking-widest rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase"
          >
            <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isRunning ? "Processing..." : "Run Execution Dry-Run"}
          </button>

          {/* Terminal */}
          <div className="h-44 bg-slate-950 border border-slate-900 rounded-xl p-3.5 font-mono text-[11px] overflow-y-auto leading-relaxed">
            {terminalLogs.length === 0 ? (
              <span className="text-slate-700">$ _  Select an asset and run dry-run...</span>
            ) : (
              terminalLogs.map((log, i) => {
                return React.createElement("div", { key: i, className: getLogClass(log) }, log);
              })
            )}
            {isRunning && <span className="text-primary animate-pulse">▌</span>}
          </div>
        </section>
      </main>

      {/* ── How it Works ──────────────────────────────────────── */}
      <section id="how-it-works" className="relative z-10 border-t border-slate-900/60 py-28">
        <div className="max-w-6xl mx-auto px-6">

          <div className="text-center mb-20">
            <p className="text-[10px] text-primary font-mono tracking-widest uppercase mb-3">Architecture</p>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tighter">How Veto Works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 relative">

            {/* Left connector: step 1 right edge → step 2 left edge */}
            <div
              className="hidden md:block absolute top-14 h-px bg-gradient-to-r from-amber-500/30 to-primary/40"
              style={{ left: "calc(16.667% + 3.5rem)", right: "calc(50% + 3.5rem)" }}
            />
            {/* Right connector: step 2 right edge → step 3 left edge */}
            <div
              className="hidden md:block absolute top-14 h-px bg-gradient-to-r from-primary/40 to-primary/20"
              style={{ left: "calc(50% + 3.5rem)", right: "calc(16.667% + 3.5rem)" }}
            />

            {/* Step 1 */}
            <div className="flex flex-col items-center text-center px-6">
              <div className="w-28 h-28 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-amber-500/10 to-transparent" />
                <svg className="w-12 h-12 text-amber-400 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-5 h-5 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-[10px] font-bold font-mono">1</span>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Agent Proposes Trade</span>
              </div>
              <h3 className="font-display font-bold text-slate-200 text-sm uppercase tracking-wide mb-3">AI Trading Agent</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Detects a market opportunity. Builds a trade payload with 50 recent price data points bundled as calldata. Sends transaction to VetoVault.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center px-6">
              <div className="w-28 h-28 rounded-full bg-primary/5 border border-primary/20 flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 rounded-full bg-linear-to-br from-primary/10 to-transparent" />
                <ShieldIcon className="w-12 h-12 text-primary relative z-10" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-bold font-mono">2</span>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">WASM Computes Risk</span>
              </div>
              <h3 className="font-display font-bold text-slate-200 text-sm uppercase tracking-wide mb-3">Stylus Coprocessor</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Rust WASM processes the 50-point array in O(N), computing BPS variance in &lt;15ms — using ~90% less gas than equivalent Solidity bytecode.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center px-6">
              <div className="w-28 h-28 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-red-500/5" />
                <svg className="w-12 h-12 text-slate-400 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-bold font-mono">3</span>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Block or Execute</span>
              </div>
              <h3 className="font-display font-bold text-slate-200 text-sm uppercase tracking-wide mb-3">VetoVault Decision</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Variance above threshold? Transaction reverts with <code className="text-red-400 text-[10px] font-mono">VolatilityExceedsThreshold</code>. Capital stays untouched.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── System Architecture ────────────────────────────────── */}
      <section className="relative z-10 border-t border-slate-900/60 py-28">
        <div className="max-w-6xl mx-auto px-6">

          <div className="text-center mb-20">
            <p className="text-[10px] text-primary font-mono tracking-widest uppercase mb-3">Capabilities</p>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tighter">System Architecture</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Card 1 */}
            <div className="glass-card border-gradient p-8 flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-center text-primary mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-white text-xs uppercase tracking-widest mb-3">Stylus Math Coprocessing</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6 flex-1">
                Decouple heavy computation from EVM. Historical variance and on-chain statistics computed using compiled Rust WASM — a fraction of pure-Solidity gas cost.
              </p>
              <div className="bg-slate-950/70 rounded-lg p-3.5 border border-slate-900 font-mono text-[10px] space-y-1">
                <div className="text-slate-600">{"// Solidity (N=50)"}</div>
                <div className="text-red-400">gas: 142,160</div>
                <div className="text-slate-600 pt-1">{"// Stylus WASM (N=50)"}</div>
                <div className="text-primary">gas: ~14,200</div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="glass-card border-gradient p-8 flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center justify-center text-red-400 mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-white text-xs uppercase tracking-widest mb-3">Zero-Trust Interception</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6 flex-1">
                Even fully compromised agents can&apos;t bypass Veto. Volatility thresholds are enforced at consensus — dangerous trades revert with O(1) gas, vault capital untouched.
              </p>
              <div className="bg-slate-950/70 rounded-lg p-3.5 border border-slate-900 font-mono text-[10px] text-red-400 leading-relaxed">
                {"revert VolatilityExceedsThreshold("}<br />
                {"  uint256 computed,  // 2450"}<br />
                {"  uint256 threshold  // 1000"}<br />
                {");"}
              </div>
            </div>

            {/* Card 3 */}
            <div className="glass-card border-gradient p-8 flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-white text-xs uppercase tracking-widest mb-3">Calldata Optimistic Oracles</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6 flex-1">
                No Chainlink. No oracle latency. Prices travel as transaction calldata — submitted by the agent, validated on-chain by Stylus in &lt;15ms. Manipulation-resistant by design.
              </p>
              <div className="bg-slate-950/70 rounded-lg p-3.5 border border-slate-900 font-mono text-[10px] text-amber-400/80 leading-relaxed">
                <span className="text-slate-500">fn </span>{"executeSwap("}<br />
                {"  token: Address,"}<br />
                {"  "}<span className="text-amber-400">{"prices: Vec<U256>"}</span><br />
                {") -> Result<()>"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Contracts ─────────────────────────────────────── */}
      <section id="contracts" className="relative z-10 border-t border-slate-900/60 py-28">
        <div className="max-w-4xl mx-auto px-6">

          <div className="text-center mb-16">
            <p className="text-[10px] text-primary font-mono tracking-widest uppercase mb-3">Deployed & Verified</p>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tighter mb-4">Live on Arbitrum Sepolia</h2>
            <p className="text-sm text-slate-500">Production-deployed on Robinhood Chain — an Arbitrum Orbit testnet</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {[
              { label: "Risk Engine", sublabel: "Stylus WASM Coprocessor", address: "0x2c0eebee49b38b2fe363664077003339e7b45d64", accent: true },
              { label: "VetoVault", sublabel: "Solidity EVM Contract", address: "0xba53711364C0fde5F6e8D450CFAd2655ADA70eD2", accent: true },
              { label: "Agent Wallet", sublabel: "Python Trading Agent EOA", address: "0x2236AA5667BAbcB4218288517d6aE75bBbd486Af", accent: true },
            ].map(({ label, sublabel, address, accent }) => (
              <a
                key={label}
                href={`https://sepolia.arbiscan.io/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`glass-card p-5 flex items-start gap-4 group hover:border-primary/30 transition-colors ${accent ? "sm:col-span-1" : "sm:col-span-2"}`}
              >
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${accent ? "bg-primary shadow-[0_0_8px_rgba(0,200,5,0.5)]" : "bg-slate-700"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-xs text-slate-300 font-semibold group-hover:text-primary transition-colors">{label}</p>
                    <svg className="w-3 h-3 text-slate-700 group-hover:text-primary transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                  <p className="text-[10px] text-slate-600 font-mono uppercase tracking-wider mb-2">{sublabel}</p>
                  <p className="font-mono text-[11px] text-slate-400 break-all">{address}</p>
                </div>
              </a>
            ))}
          </div>

          <div className="p-4 bg-slate-900/30 border border-slate-800/60 rounded-xl text-center">
            <p className="text-[11px] text-slate-600 font-mono">
              Chain:&nbsp;<span className="text-slate-400">Robinhood Chain</span>&nbsp;&nbsp;·&nbsp;&nbsp;
              Network:&nbsp;<span className="text-slate-400">Arbitrum Sepolia</span>&nbsp;&nbsp;·&nbsp;&nbsp;
              Status:&nbsp;<span className="text-primary">Live</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────── */}
      <section className="relative z-10 border-t border-slate-900/60 py-32">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase mb-6">Security Console</p>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter mb-5 leading-none">
            Your AI tried.<br />
            <span className="bg-linear-to-r from-red-400 via-orange-300 to-primary bg-clip-text text-transparent">
              Veto said no.
            </span>
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-12 max-w-md mx-auto">
            Watch live trade interceptions in the security console. See real WASM variance computations blocking volatile agent transactions in real-time.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-3 px-9 py-4 rounded-xl bg-primary text-slate-950 font-display font-black text-sm tracking-widest hover:shadow-2xl hover:shadow-primary/30 transition-all hover:scale-[1.02]"
          >
            Open Security Console
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Sponsors ──────────────────────────────────────────── */}
      <section className="relative z-10 border-t border-slate-900/60 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[10px] text-slate-700 font-mono tracking-widest uppercase mb-10">
            Built For
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 mb-12">
            {/* Arbitrum */}
            <a
              href="https://arbitrum.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-[#28A0F0]/40 hover:bg-[#28A0F0]/5 transition-all group"
            >
              <img src="/icon-arbitrum.svg" alt="Arbitrum" className="w-5 h-5 object-contain shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold text-slate-300 group-hover:text-[#28A0F0] transition-colors leading-none">Arbitrum</p>
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mt-0.5">Stylus Platform</p>
              </div>
            </a>

            {/* Robinhood Chain */}
            <a
              href="https://robinhoodchain.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-[#00C805]/40 hover:bg-[#00C805]/5 transition-all group"
            >
              <img src="/icon-robinhood-chain.png" alt="Robinhood Chain" className="w-5 h-5 object-contain shrink-0 rounded-full" />
              <div className="text-left">
                <p className="text-xs font-bold text-slate-300 group-hover:text-[#00C805] transition-colors leading-none">Robinhood Chain</p>
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mt-0.5">Chain Infrastructure</p>
              </div>
            </a>

            {/* HackQuest */}
            <a
              href="https://www.hackquest.io/hackathons/Arbitrum-Open-House-London-Online-Buildathon"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
            >
              <img src="/icon-hackquest.png" alt="HackQuest" className="w-5 h-5 object-contain shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold text-slate-300 group-hover:text-violet-400 transition-colors leading-none">HackQuest</p>
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mt-0.5">Arbitrum London 2026</p>
              </div>
            </a>
          </div>

          {/* Prize tracks */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { label: "Overall — Robinhood Chain", prize: "$40K", color: "text-[#00C805] border-[#00C805]/20 bg-[#00C805]/5" },
              { label: "Best Agentic Project",      prize: "$7K",  color: "text-[#28A0F0] border-[#28A0F0]/20 bg-[#28A0F0]/5" },
              { label: "Grants",                    prize: "$30K", color: "text-violet-400 border-violet-500/20 bg-violet-500/5" },
            ].map(({ label, prize, color }) => (
              <div key={label} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-mono ${color}`}>
                <span className="text-current opacity-60">{label}</span>
                <span className="font-bold">{prize}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-slate-900/60 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">

          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="Veto" className="w-5 h-5" />
            <span className="font-display text-xs font-black tracking-widest">
              <span className="text-primary">VE</span><span className="text-danger">TO</span>
            </span>
          </div>

          <p className="text-[10px] text-slate-700 font-mono text-center">
            Arbitrum Open House London 2026 &bull; Robinhood Chain &bull; Stylus + Solidity + Python
          </p>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            LIVE ON TESTNET
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes pathFlow {
          0% { left: -20%; }
          100% { left: 120%; }
        }
        .animate-path-flow {
          animation: pathFlow 1s linear infinite;
        }
      `}</style>

      {/* Red Alert Modal */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="relative glass-card border border-red-500/30 max-w-md w-full mx-4 overflow-hidden shadow-2xl shadow-red-500/10 p-6 glow-red animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <svg className="w-8 h-8 animate-pulse shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-display font-black text-sm uppercase tracking-widest leading-none">
                  Veto Shield Intercept
                </h3>
                <p className="text-[9px] font-mono text-red-400/80 mt-1 uppercase tracking-wider">REVERTED ON-CHAIN</p>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-5">
              <p className="font-mono text-xs text-red-400 leading-normal">
                <span className="font-bold text-red-500 uppercase block mb-1">Custom Error:</span>
                VolatilityExceedsThreshold(2450, 1000)
              </p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              The Arbitrum Stylus WASM risk engine calculated a historical price variance of <span className="text-slate-200 font-bold font-mono">2,450 BPS</span>, which exceeds the configured maximum safety limit of <span className="text-slate-200 font-bold font-mono">1,000 BPS</span> (10.0%). The swap transaction was immediately vetoed, safeguarding vault capital.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockedModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 font-display font-black text-[10px] tracking-wider hover:bg-red-500/20 transition-all uppercase"
              >
                Dismiss Shield Warn
              </button>
              <Link
                href="/dashboard"
                className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-display font-black text-[10px] tracking-wider hover:bg-red-600 transition-all text-center flex items-center justify-center uppercase"
              >
                Open Console
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
