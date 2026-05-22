"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ─── Interactive Canvas Background Component ───────────────────

function CanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle class
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.radius = Math.random() * 1.5 + 0.5;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx = -this.vx;
        if (this.y < 0 || this.y > height) this.vy = -this.vy;
      }

      draw(c: CanvasRenderingContext2D) {
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        c.fillStyle = "rgba(0, 200, 5, 0.4)";
        c.fill();
      }
    }

    const particlesCount = Math.min(Math.floor((width * height) / 12000), 100);
    const particles: Particle[] = [];
    for (let i = 0; i < particlesCount; i++) {
      particles.push(new Particle());
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("mouseleave", handleMouseLeave);

    const drawGrid = (c: CanvasRenderingContext2D) => {
      c.strokeStyle = "rgba(0, 200, 5, 0.02)";
      c.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, height);
        c.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(width, y);
        c.stroke();
      }
    };

    // Animation Loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw background cybernetic grid
      drawGrid(ctx);

      // Update & Draw Particles
      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });

      // Draw connections
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.15;
            ctx.strokeStyle = `rgba(0, 200, 5, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }

        // Connect to mouse
        if (mouseRef.current.active) {
          const mdx = particles[i].x - mouseRef.current.x;
          const mdy = particles[i].y - mouseRef.current.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mdist < 180) {
            const malpha = (1 - mdist / 180) * 0.25;
            ctx.strokeStyle = `rgba(0, 200, 5, ${malpha})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
    />
  );
}

// ─── Main Landing Page Component ────────────────────────────────

export default function LandingPage() {
  const [selectedAsset, setSelectedAsset] = useState<"RUGCOIN" | "ETH">("RUGCOIN");
  const [simState, setSimState] = useState<"idle" | "sending" | "evaluating" | "result">("idle");
  const [simResult, setSimResult] = useState<"blocked" | "executed" | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const simInterval = useRef<NodeJS.Timeout | null>(null);

  const startSimulation = useCallback(() => {
    if (simInterval.current) clearInterval(simInterval.current);
    setSimState("sending");
    setSimResult(null);
    setTerminalLogs([`$ veto-agent --mode dry-run --test-asset ${selectedAsset}`]);

    const steps = [
      {
        delay: 600,
        action: () => {
          setTerminalLogs((prev) => [
            ...prev,
            `[Agent] Opportunity detected for ${selectedAsset}`,
            `[Agent] Initializing trade execution payload...`,
          ]);
        },
      },
      {
        delay: 1400,
        action: () => {
          setSimState("evaluating");
          setTerminalLogs((prev) => [
            ...prev,
            `[Veto] Transaction intercepted by WASM Risk Sandbox`,
            `[RiskEngine] Pulling price array from optimistic payload...`,
            `[RiskEngine] Performing O(N) variance calculations in Stylus WASM`,
          ]);
        },
      },
      {
        delay: 2400,
        action: () => {
          setSimState("result");
          if (selectedAsset === "RUGCOIN") {
            setSimResult("blocked");
            setTerminalLogs((prev) => [
              ...prev,
              `[RiskEngine] Computed variance: 2,450 BPS (limit: 1,000 BPS)`,
              `[RiskEngine] RISK DETECTED: Volatility exceeds absolute safety limits`,
              `[BLOCK] REVERTED: VolatilityExceedsThreshold(2450, 1000)`,
              `[Veto] Transaction rejected on-chain. Capital remains in Solidity Vault.`,
            ]);
          } else {
            setSimResult("executed");
            setTerminalLogs((prev) => [
              ...prev,
              `[RiskEngine] Computed variance: 120 BPS (limit: 1,000 BPS)`,
              `[RiskEngine] RISK VERIFIED: Variance is within safe parameters`,
              `[PASS] APPROVED: Forwarding execution call to Vault`,
              `[Vault] Swap executed successfully. TX: 0x8dfb2...ce32`,
            ]);
          }
        },
      },
    ];

    steps.forEach((step) => {
      setTimeout(step.action, step.delay);
    });
  }, [selectedAsset]);

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden select-none font-sans bg-slate-950">
      <CanvasBackground />

      {/* Top Navigation */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-slate-900/40 bg-slate-950/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <span className="font-display text-lg font-bold tracking-wider text-slate-100">
              VE<span className="text-primary">TO</span>
            </span>
            <span className="ml-2 px-1.5 py-0.2 rounded text-[7px] font-bold bg-primary/10 text-primary border border-primary/20 tracking-widest uppercase">ACTIVE</span>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-mono font-bold bg-primary/5 hover:bg-primary/15 transition-all shadow-md shadow-primary/5"
        >
          Enter Console
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-6 py-12 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Side: Headline & Copy */}
        <section className="lg:col-span-6 flex flex-col items-start text-left animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800 mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">WASM math coprocessor sandbox</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-6">
            <span className="text-slate-500 block text-2xl sm:text-3xl font-medium tracking-normal mb-1">Your AI Agent Tried.</span>
            <span className="bg-gradient-to-r from-red-500 via-primary to-emerald-400 bg-clip-text text-transparent filter drop-shadow-[0_0_15px_rgba(0,200,5,0.15)] font-extrabold">
              Veto Said No.
            </span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8 max-w-lg">
            Veto is a hybrid EVM/WASM execution sandbox on Robinhood Chain that uses Arbitrum Stylus as an on-chain math coprocessor to compute historical asset variance in real time, physically preventing autonomous trading agents from executing volatile, hallucinated transactions.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="relative group overflow-hidden inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-slate-950 font-display font-bold text-sm hover:shadow-lg hover:shadow-primary/30 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              Launch Security Console
              <svg className="w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </Link>
            
            <a
              href="#sandbox"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-slate-800 text-slate-300 font-display font-bold text-sm bg-slate-900/30 hover:bg-slate-900/60 hover:text-white transition-all"
            >
              Test Risk Sandbox
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
              </svg>
            </a>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-6 border-t border-slate-900/80 pt-8 mt-12 w-full">
            <div>
              <p className="text-xl sm:text-2xl font-mono font-bold text-slate-200">&lt; 15ms</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Evaluation Latency</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-mono font-bold text-primary">~90%</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Gas Reduction</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-mono font-bold text-red-400">Zero</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Hallucinated Trades</p>
            </div>
          </div>
        </section>

        {/* Right Side: Interactive Sandbox Simulator */}
        <section id="sandbox" className="lg:col-span-6 flex flex-col animate-fade-in-up delay-200">
          <div className="glass-card border-gradient p-6 relative overflow-hidden">
            
            {/* Control Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
              <div>
                <h3 className="font-display font-bold text-sm text-slate-200">VETO WASM COPROCESSOR SANDBOX</h3>
                <p className="text-[11px] text-slate-500 font-mono">Test execution safety of simulated agent trades</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedAsset("RUGCOIN")}
                  className={`px-3 py-1 text-xs font-mono rounded border ${
                    selectedAsset === "RUGCOIN"
                      ? "bg-red-500/10 text-red-400 border-red-500/40"
                      : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
                  } transition-colors cursor-pointer`}
                >
                  RugCoin (Volatile)
                </button>
                <button
                  onClick={() => setSelectedAsset("ETH")}
                  className={`px-3 py-1 text-xs font-mono rounded border ${
                    selectedAsset === "ETH"
                      ? "bg-primary/10 text-primary border-primary/40"
                      : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
                  } transition-colors cursor-pointer`}
                >
                  ETH (Stable)
                </button>
              </div>
            </div>

            {/* Visual Flow Animation */}
            <div className="h-40 bg-slate-950/60 border border-slate-900 rounded-xl p-4 flex items-center justify-between relative mb-6">
              
              {/* Left Node: Agent */}
              <div className="flex flex-col items-center z-10 w-24">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
                  simState === "sending" ? "border-amber-500/50 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "border-slate-800 bg-slate-900"
                }`}>
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-[10px] font-mono mt-2 text-slate-500 uppercase">Trading Agent</span>
              </div>

              {/* Connecting Pathway */}
              <div className="flex-grow h-1 bg-slate-900 mx-2 relative overflow-hidden">
                {simState === "sending" && (
                  <div className="absolute top-0 h-full w-4 bg-amber-400/80 rounded blur-xs animate-path-flow" />
                )}
                {simState === "evaluating" && (
                  <div className="absolute top-0 h-full w-full bg-gradient-to-r from-amber-400 via-primary to-primary animate-pulse" />
                )}
                {simState === "result" && (
                  <div className={`absolute top-0 h-full w-full ${simResult === "blocked" ? "bg-red-500/40" : "bg-primary/40"}`} />
                )}
              </div>

              {/* Middle Node: Veto Shield */}
              <div className="flex flex-col items-center z-10 w-28">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all ${
                  simState === "evaluating"
                    ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_rgba(0,200,5,0.2)]"
                    : simState === "result"
                    ? simResult === "blocked"
                      ? "border-red-500/50 bg-red-500/10 shadow-[0_0_25px_rgba(239,68,68,0.25)]"
                      : "border-primary/50 bg-primary/10 shadow-[0_0_25px_rgba(0,200,5,0.25)]"
                    : "border-slate-800 bg-slate-900"
                }`}>
                  {simState === "evaluating" ? (
                    <svg className="w-7 h-7 text-primary animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : simResult === "blocked" ? (
                    <svg className="w-8 h-8 text-red-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : simResult === "executed" ? (
                    <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
                <span className="text-[10px] font-mono mt-2 text-slate-500 uppercase">WASM Risk Guard</span>
              </div>

              {/* Connecting Pathway */}
              <div className="flex-grow h-1 bg-slate-900 mx-2 relative overflow-hidden">
                {simState === "result" && simResult === "executed" && (
                  <div className="absolute top-0 h-full w-full bg-primary/40" />
                )}
              </div>

              {/* Right Node: Vault */}
              <div className="flex flex-col items-center z-10 w-24">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
                  simResult === "executed" ? "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(0,200,5,0.15)]" : "border-slate-800 bg-slate-900"
                }`}>
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <span className="text-[10px] font-mono mt-2 text-slate-500 uppercase">Solidity Vault</span>
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={startSimulation}
              disabled={simState === "sending" || simState === "evaluating"}
              className="w-full py-3 mb-6 font-display text-sm font-bold tracking-wider rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase"
            >
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Execution Safety dry-run
            </button>

            {/* Sandbox Console Output */}
            <div className="h-44 bg-slate-950 border border-slate-900 rounded-xl p-4 font-mono text-[11px] overflow-y-auto leading-relaxed flex flex-col justify-start">
              {terminalLogs.length === 0 ? (
                <span className="text-slate-600 italic">Select asset parameters and run dry-run to print logs...</span>
              ) : (
                terminalLogs.map((log, index) => {
                  let colorClass = "text-slate-400";
                  if (log.startsWith("$")) colorClass = "text-primary";
                  else if (log.includes("[BLOCK]") || log.includes("RISK DETECTED")) colorClass = "text-red-400";
                  else if (log.includes("[PASS]") || log.includes("Vault")) colorClass = "text-primary";
                  else if (log.includes("[Agent]")) colorClass = "text-slate-500";
                  else if (log.includes("[Veto]")) colorClass = "text-slate-300";
                  else if (log.includes("[WASM]")) colorClass = "text-primary font-semibold";

                  return (
                    <div key={index} className={colorClass}>
                      {log}
                    </div>
                  );
                })
              )}
              {(simState === "sending" || simState === "evaluating") && (
                <span className="text-primary animate-pulse mt-1">▌ Processing execution...</span>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Features Section */}
      <section className="relative z-10 max-w-7xl mx-auto w-full px-6 py-16 border-t border-slate-900/60">
        <h2 className="font-display text-xl font-bold tracking-widest text-slate-400 mb-12 uppercase text-center">
          SYSTEM HIGHLIGHTS & ARCHITECTURE
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="glass-card p-6 border-gradient">
            <div className="w-10 h-10 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-center text-primary mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 className="font-display font-bold text-slate-200 text-sm uppercase mb-2">Stylus Math Coprocessing</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Decouple computation from EVM. Historical variance and complex statistics are computed on-chain using high-performance compiled Rust WASM bytecodes, saving substantial gas.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-card p-6 border-gradient">
            <div className="w-10 h-10 rounded-lg bg-red-500/5 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-display font-bold text-slate-200 text-sm uppercase mb-2">Zero-Trust Interception</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Keep the vault keys safe. Even if trading agents are fully compromised or hallucinate high-risk executions, Veto enforces boundary thresholds at the consensus layer, resulting in O(1) gas reverts.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-card p-6 border-gradient">
            <div className="w-10 h-10 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 className="font-display font-bold text-slate-200 text-sm uppercase mb-2">Calldata Optimistic Oracles</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Eliminate dependency on slow on-chain pricing feeds. The trading agent proposes prices as transaction input calldata, and Veto validates the volatility on-chain, preventing manipulation via sub-second math checks.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900/60 py-8 text-center bg-slate-950/40 backdrop-blur-sm">
        <p className="text-xs text-slate-600 font-mono">
          Veto &bull; Arbitrum Open House London 2026 &bull; Robinhood Chain
        </p>
        <p className="text-[10px] text-slate-700 font-mono mt-1 italic uppercase tracking-wider">
          Your AI tried. Veto said no.
        </p>
      </footer>

      {/* Style overrides for custom animations */}
      <style jsx global>{`
        @keyframes pathFlow {
          0% {
            left: -20%;
          }
          100% {
            left: 120%;
          }
        }
        .animate-path-flow {
          animation: pathFlow 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
