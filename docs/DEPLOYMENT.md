# Veto — Full Stack Deployment Guide 🚀

This guide outlines the production deployment process for the entire Veto system:
1.  **Smart Contracts** (Arbitrum Sepolia / EVM & WASM)
2.  **Frontend Dashboard** (Vercel)
3.  **AI Trading Agent** (Railway)

---

## 1. On-Chain Contracts Deployment

The smart contracts consist of a Solidity vault and a Rust/Stylus WASM risk engine.

### Prerequisites
*   [Foundry (Forge & Cast)](https://book.getfoundry.sh/) installed.
*   [Cargo Stylus CLI](https://github.com/OffchainLabs/cargo-stylus) installed.
*   Testnet ETH on Arbitrum Sepolia for both **Owner** and **Agent** wallets.

### Steps
1.  Run the deployment script with your RPC URL and private keys:
    ```bash
    PRIVATE_KEY=0xYourOwnerPrivateKey \
    AGENT_PRIVATE_KEY=0xYourAgentPrivateKey \
    RPC_URL=https://arb-sepolia.g.alchemy.com/v2/your-api-key \
    ./scripts/deploy.sh
    ```
    This script compiles the Rust risk engine, deploys it to the WASM runtime, compiles/deploys the Solidity `VetoVault`, and pre-funds it with `0.01 ETH`.

2.  **Register the Agent (If not done by script):**
    If deploying manually or updating the agent address, call `setAgent` on the vault using the Owner wallet:
    ```bash
    cast send <VAULT_ADDRESS> "setAgent(address)" <AGENT_ADDRESS> \
      --private-key 0xYourOwnerPrivateKey \
      --rpc-url <RPC_URL>
    ```

3.  **Verify On-Chain State:**
    Run the verify script to check the contract state:
    ```bash
    ./scripts/verify.sh
    ```

---

## 2. Frontend Dashboard Deployment (Vercel)

The Next.js 16 dashboard provides real-time visualization of agent trades and system logs.

### Steps
1.  Create a new project on [Vercel](https://vercel.com) and link your GitHub repository.
2.  Set the **Root Directory** to `dashboard/`.
3.  Add the following **Environment Variables** in the Vercel project settings:
    *   `NEXT_PUBLIC_RPC_URL` = `https://arb-sepolia.g.alchemy.com/v2/your-api-key`
    *   `NEXT_PUBLIC_VAULT_ADDRESS` = `0xYourDeployedVaultAddress`
    *   `NEXT_PUBLIC_RISK_ENGINE_ADDRESS` = `0xYourDeployedRiskEngineAddress`
4.  Trigger a deployment. Vercel will automatically build and publish the frontend.

---

## 3. Python AI Agent Deployment (Railway)

To run the AI Trading Agent 24/7 in the cloud without requiring your laptop to remain powered on, deploy it as a background service on Railway.

### Prerequisites
*   A [Railway](https://railway.app) account.
*   Railway CLI installed (run `brew install railway` or `npm install -g @railway/cli`).

### Deploy via Railway CLI (Fastest)
1.  Authenticate your terminal:
    ```bash
    railway login
    ```
2.  Initialize or link to a Railway project:
    ```bash
    railway link
    ```
3.  Deploy the project service:
    ```bash
    railway up
    ```

### Configuration (Environment Variables)
Once the service is created on the Railway Dashboard, add the following variables in the **Variables** tab:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `DEMO_MODE` | `false` | Disables simulation and runs live transactions |
| `RPC_URL` | `https://arb-sepolia.g.alchemy.com/v2/your-api-key` | RPC endpoint to sign transactions |
| `VETO_VAULT_ADDRESS` | `0xYourDeployedVaultAddress` | Deployed vault contract address |
| `RISK_ENGINE_ADDRESS` | `0xYourDeployedRiskEngineAddress` | Deployed WASM risk engine address |
| `AGENT_PRIVATE_KEY` | `0xYourAgentPrivateKey` | Private key used to sign trade proposals |
| `COINGECKO_API_URL` | `https://api.coingecko.com/api/v3` | Token price API endpoint |

### Start Command Setup
Railway will automatically detect Python based on `agent/requirements.txt`. Set the **Start Command** in the service settings to run the agent daemon:
```bash
python agent/agent.py
```

> [!TIP]
> Ensure that the Agent wallet has sufficient gas funds (`~0.015 ETH`) on Arbitrum Sepolia to submit on-chain transactions indefinitely.
