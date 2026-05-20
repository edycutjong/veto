# 🛡️ AegisVault

**Hybrid EVM/WASM Execution Sandbox — Physically preventing AI agents from executing hallucinated trades.**

> Solidity holds the money. Rust does the math. If the math says "too volatile," the transaction reverts before any funds move.

Built for the [Arbitrum Open House London: Online Buildathon](https://www.hackquest.io/hackathons/Arbitrum-Open-House-London-Online-Buildathon) — Deployed on **Robinhood Chain**.

---

## ⚡ Gas Benchmark: Stylus vs Solidity

> The entire point of AegisVault: proving WASM is the better math engine.

| Array Size | Solidity Gas | Stylus (WASM) Gas | Savings |
|-----------|-------------|-------------------|---------|
| 50 items  | *TBD*       | *TBD*             | *TBD*   |
| 100 items | *TBD*       | *TBD*             | *TBD*   |
| 200 items | *TBD*       | *TBD*             | *TBD*   |

*Benchmarks run on Robinhood Chain Testnet. Both contracts compute identical variance over the same price arrays.*

---

## 🧠 The Problem

Autonomous AI trading agents are proliferating across DeFi. They promise hands-off yield optimization. But:

1. **AI agents don't understand risk** — they optimize for return, not safety
2. **Smart contract wallets have no math guardrails** — ERC-4337/Safe implement access control (who can call), not execution physics (what's sane to call)
3. **On-chain statistical computation is prohibitively expensive** — calculating variance over 100+ data points in Solidity costs tens of thousands of gas

**Result:** Retail users give AI agents the keys and pray.

## 💡 The Solution

AegisVault uses Arbitrum **Stylus (Rust)** as a **math coprocessor** — a WASM-compiled contract that computes historical asset variance on-chain, physically preventing AI agents from executing high-volatility trades.

### Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   AI Agent       │────▶│  AegisVault.sol  │────▶│  RiskEngine.rs   │
│   (Python)       │     │  (EVM - Funds)   │     │  (WASM - Math)   │
│                  │     │                  │     │                  │
│  Fetches prices  │     │  Holds ETH       │     │  Computes        │
│  Formats array   │     │  Access control  │     │  variance over   │
│  Signs tx        │     │  Calls Stylus    │     │  100 prices      │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                         │
                                                    variance > threshold?
                                                    YES → REVERT ❌
                                                    NO  → EXECUTE ✅
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Vault** | Solidity (EVM) — fund custody, access control |
| **Risk Engine** | Rust/Stylus (WASM) — variance computation |
| **AI Agent** | Python + LangChain — market monitoring + trade execution |
| **Dashboard** | Next.js + Tailwind — cyberpunk control panel |
| **Chain** | Robinhood Chain (Arbitrum Orbit) |

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/edycutjong/aegisvault.git
cd aegisvault

# Deploy contracts (requires cargo-stylus)
cd contracts/stylus && cargo stylus deploy --endpoint <ROBINHOOD_RPC>
cd ../solidity && forge deploy

# Run the agent
cd ../../agent && pip install -r requirements.txt && python agent.py

# Run the dashboard
cd ../dashboard && npm install && npm run dev
```

## 📜 License

MIT
