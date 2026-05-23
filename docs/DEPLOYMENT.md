# Veto — Deployment Guide

This guide covers deploying the full Veto stack from scratch:

1. [Prerequisites](#prerequisites)
2. [Smart Contracts](#1-smart-contracts)
3. [Contract Verification](#2-contract-verification)
4. [Dashboard (Vercel)](#3-dashboard-vercel)
5. [AI Agent (Railway)](#4-ai-agent-railway)
6. [Current Deployment](#current-deployment)

---

## Prerequisites

| Tool | Install |
|---|---|
| [Foundry](https://book.getfoundry.sh/) | `curl -L https://foundry.paradigm.xyz \| bash` |
| [cargo-stylus](https://github.com/OffchainLabs/cargo-stylus) | `cargo install cargo-stylus` |
| Rust `wasm32-unknown-unknown` target | `rustup target add wasm32-unknown-unknown` |
| Node.js ≥ 20 | [nodejs.org](https://nodejs.org) |
| Python 3.11+ | [python.org](https://python.org) |

You also need testnet ETH on **Arbitrum Sepolia** for the deployer wallet. Get it from the [Arbitrum Sepolia faucet](https://faucet.arbitrum.io).

---

## 1. Smart Contracts

The one-shot deploy script handles both contracts, agent registration, and vault funding:

```bash
PRIVATE_KEY=0xYourOwnerPrivateKey \
AGENT_PRIVATE_KEY=0xYourAgentPrivateKey \
RPC_URL=https://arb-sepolia.g.alchemy.com/v2/your-api-key \
./scripts/deploy.sh
```

What it does, in order:

1. **Compiles and deploys the Stylus WASM RiskEngine** — builds the Rust crate targeting `wasm32-unknown-unknown`, uploads the WASM bytecode, and activates it via the ArbWasm precompile.
2. **Deploys VetoVault (Solidity)** — passes the RiskEngine address and the volatility threshold (default `1000 bps = 10%`) as constructor args.
3. **Registers the agent** — calls `setAgent(address)` on the vault so the agent wallet is whitelisted to propose trades.
4. **Funds the vault** — sends `0.01 ETH` to the vault so the agent has capital to trade.
5. **Writes env files** — auto-generates `agent/.env` and `dashboard/.env.local` with the new contract addresses.

> The script requires ~0.012 ETH to cover WASM data fees, gas, and the initial vault funding. Keep at least 0.015 ETH in the deployer wallet.

### Manual deploy (step by step)

If you need to redeploy only one contract:

```bash
# Deploy only the Stylus RiskEngine
cd contracts/stylus
cargo stylus deploy \
  --endpoint $RPC_URL \
  --private-key $PRIVATE_KEY \
  --no-verify

# Deploy only the VetoVault (replace RISK_ENGINE_ADDRESS)
cd contracts/solidity
forge create src/VetoVault.sol:VetoVault \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args $RISK_ENGINE_ADDRESS 1000
```

---

## 2. Contract Verification

Verification uploads source code to Arbiscan/Sourcify so judges and auditors can read the on-chain logic.

### Stylus RiskEngine (Rust/WASM)

Verification requires the transaction hash from the `cargo stylus deploy` step. Find it by checking which block the contract first appeared in and looking for a contract-creation tx (`to: null`) from the deployer in that block:

```bash
# Quick helper — finds the deployment block via eth_getCode binary search, then the tx
cast block <DEPLOY_BLOCK> --rpc-url $RPC_URL --json | python3 -c "
import json, sys
b = json.load(sys.stdin)
for h in b['transactions']: print(h)
"
```

Once you have the deployment tx hash:

```bash
cd contracts/stylus
cargo stylus verify \
  --endpoint $RPC_URL \
  --deployment-tx $DEPLOY_TX_HASH \
  --no-verify
```

`Verification successful` means the locally compiled WASM matches what is stored on-chain byte-for-byte.

> **Important:** the source must not change between `cargo stylus deploy` and `cargo stylus verify`. Any edit (even a comment) changes the WASM binary, causing a size mismatch. If the source drifted, redeploy first.

### VetoVault (Solidity)

Foundry verifies to Sourcify by default (no API key required):

```bash
cd contracts/solidity
forge verify-contract \
  $VAULT_ADDRESS \
  src/VetoVault.sol:VetoVault \
  --chain 421614 \
  --rpc-url $RPC_URL \
  --constructor-args $(cast abi-encode "constructor(address,uint256)" $RISK_ENGINE_ADDRESS 1000) \
  --watch
```

A `Status: exact_match` response means the contract is publicly readable on Arbiscan.

---

## 3. Dashboard (Vercel)

1. Create a new Vercel project and import the repository.
2. Set **Root Directory** → `dashboard/`.
3. Add these environment variables in the Vercel project settings:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | Your Alchemy or Infura Arbitrum Sepolia endpoint |
| `NEXT_PUBLIC_VAULT_ADDRESS` | Deployed VetoVault address |
| `NEXT_PUBLIC_RISK_ENGINE_ADDRESS` | Deployed RiskEngine address |

4. Deploy. Vercel handles the Next.js build automatically.

The dashboard reads live chain state from the `/api/vault` route every 5 seconds. Trade history is served either from the live agent (`NEXT_PUBLIC_AGENT_URL`) or from `public/trades.json` as a static fallback.

---

## 4. AI Agent (Railway)

The Python agent runs continuously, fetching prices and submitting trade proposals to the vault.

### Deploy via CLI

```bash
cd agent
railway login
railway link      # link to your Railway project
railway up
```

### Environment variables

Set these in the Railway service **Variables** tab:

| Variable | Value | Notes |
|---|---|---|
| `DEMO_MODE` | `false` | `true` uses simulated prices instead of CoinGecko |
| `RPC_URL` | Alchemy Arbitrum Sepolia URL | Must match the chain the contracts are on |
| `VETO_VAULT_ADDRESS` | Deployed vault address | |
| `RISK_ENGINE_ADDRESS` | Deployed RiskEngine address | |
| `AGENT_PRIVATE_KEY` | Agent EOA private key | Must be the whitelisted agent on the vault |
| `COINGECKO_API_URL` | `https://api.coingecko.com/api/v3` | |
| `LOOP_INTERVAL` | `60` | Seconds between trade cycles |
| `PORT` | `8080` | Health check and trades API port |

### Start command

Railway auto-detects Python from `requirements.txt`. Set the start command to:

```
python agent.py
```

The agent exposes a `/health` endpoint and a `/api/trades` endpoint that the dashboard polls.

---

## Current Deployment

Deployed **2026-05-23** on Arbitrum Sepolia (chain ID `421614`):

| Contract | Address | Verification |
|---|---|---|
| RiskEngine (Stylus WASM) | [`0x2c0eebee49b38b2fe363664077003339e7b45d64`](https://sepolia.arbiscan.io/address/0x2c0eebee49b38b2fe363664077003339e7b45d64) | `cargo stylus verify` — exact match |
| VetoVault (Solidity) | [`0xba53711364C0fde5F6e8D450CFAd2655ADA70eD2`](https://sepolia.arbiscan.io/address/0xba53711364C0fde5F6e8D450CFAd2655ADA70eD2) | Sourcify — exact match |
| Agent Wallet (EOA) | [`0x2236AA5667BAbcB4218288517d6aE75bBbd486Af`](https://sepolia.arbiscan.io/address/0x2236AA5667BAbcB4218288517d6aE75bBbd486Af) | — |

**Deployment tx (RiskEngine):** [`0x2c0eebee49b38b2fe363664077003339e7b45d64f92e8906af55c2347d54d0ca`](https://sepolia.arbiscan.io/tx/0x2c0eebee49b38b2fe363664077003339e7b45d64f92e8906af55c2347d54d0ca)

**Notable on-chain transactions:**

| Scenario | TX | Result |
|---|---|---|
| Volatile asset (RUGCOIN) | [`0xdd3fc5...`](https://sepolia.arbiscan.io/tx/0xdd3fc5faa8127784159b2ecf9e7c26dd6c5f4e37855cadac6255b9abcabc069f) | Reverted — `VolatilityExceedsThreshold` |
| Stable asset (ETH) | [`0x20c9ef...`](https://sepolia.arbiscan.io/tx/0x20c9ef0683ac5bda2c264e1ed384df807217898f9dd2007c4dc5603c64df6f0d) | Executed |
