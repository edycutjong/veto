# 🛡️ AegisVault — Agent Instructions

## Project
Hybrid EVM/WASM execution sandbox on Robinhood Chain that uses Arbitrum Stylus (Rust) as a math coprocessor to natively compute historical asset variance on-chain, physically preventing AI agents from executing hallucinated trades.

## Hackathon
**Arbitrum Open House London: Online Buildathon** (HackQuest) — Targeting Overall Robinhood Reserved ($40K) + Best Agentic Robinhood Reserved ($7K) = **$47K sweep**.

## Structure
- `contracts/stylus/` — Rust/Stylus Risk Engine (WASM math coprocessor)
- `contracts/solidity/` — Solidity Vault contract + Solidity RiskEngine benchmark
- `agent/` — Python/LangChain autonomous trading agent
- `dashboard/` — Next.js cyberpunk control panel
- `test/` — Contract tests
- `scripts/` — Deploy, benchmark, demo scripts
- `docs/` — Demo script, architecture diagrams

## Tech Stack
| Layer | Technology |
|---|---|
| **Vault** | Solidity (EVM) |
| **Risk Engine** | Rust/Stylus (WASM) — `no_std` |
| **AI Agent** | Python 3.12, LangChain, web3.py |
| **Dashboard** | Next.js, Tailwind CSS, wagmi, viem |
| **Chain** | Robinhood Chain (Arbitrum Orbit) |

## Key Rules
- **Contracts** = Hybrid EVM/WASM architecture — Solidity holds funds, Rust does math
- **Rust** = `#![no_std]`, pure `U256` integer math, NO floats
- **Prices** = Scaled by 10,000 (multiply off-chain, integer math on-chain)
- **Variance** = NOT standard deviation (no `sqrt()` needed)
- **Oracle** = Optimistic Calldata Oracle — agent passes prices as calldata (no Chainlink)
- **Colors** = Red (#ef4444) for blocked, Cyan (#06b6d4) for safe, Slate (#1e293b) for background
- **Typography** = JetBrains Mono (data), Inter (body), Orbitron (headings)
- **Aesthetic** = Cyberpunk / Military SOC, dark mode only

## Critical Patterns
- The Risk Engine is ~20 lines of Rust — keep it simple
- Variance computation: Loop 1 = mean, Loop 2 = sum of squared deviations
- Custom Stylus error: `VolatilityExceedsThreshold { computed: U256, limit: U256 }`
- Dashboard catches custom error via viem and renders red alert modal
- Gas benchmark (Stylus vs Solidity) MUST be in README — this is the proof
