# Veto — Autonomous Trading Agent 🤖📈

The **Veto Autonomous Trading Agent** is an aggressive Python-based daemon that simulates or executes trade proposals on-chain. It is designed to demonstrate how the **Veto Vault** and the **Arbitrum Stylus (Rust) Risk Engine** intercept and physically block volatile, high-risk, or hallucinated trades in real-time, keeping the vault's assets safe.

---

## ⚙️ How it Works

1. **Market Monitoring**: The agent scans asset pools (real CoinGecko data or simulated scenarios).
2. **Aggressive Allocations**: The agent's decision logic is intentionally aggressive—it will try to allocate funds to high-yield/volatile assets (like simulated shitcoins).
3. **Price Pipeline**: It gathers historical price series data to back up the trade.
4. **On-Chain Proposal**: It formats the price series into a packed `uint256[]` array and submits the trade calldata to the `executeTrade` function of the `VetoVault` contract.
5. **Stylus Interception**: The `VetoVault` forwards the price payload to the Stylus Rust Risk Engine. If the computed variance exceeds the permitted threshold, the transaction is **reverted** on-chain with a custom error, preventing loss of funds.

---

## 📁 File Structure

*   `agent.py`: Main orchestrator containing the trade-execution logic, background daemon thread, and FastAPI telemetry server.
*   `price_fetcher.py`: Queries CoinGecko API for real-time prices or generates mock historical datasets for demo mode.
*   `config.py`: Loads environment configurations, handles fixed-point price scaling, and stores Contract ABIs.
*   `Procfile`: Specifies the Railway start command (`web: python agent.py`).
*   `requirements.txt`: Python package dependencies (Web3.py, FastAPI, Uvicorn, etc.).
*   `tests/`: Unit and integration test suites validating execution logic and price fetching.

---

## 🛠️ Local Setup

### Prerequisites
*   Python 3.11+
*   Local virtual environment manager

### Installation
1. Navigate to the agent directory:
   ```bash
   cd agent
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment template and fill in your variables:
   ```bash
   cp .env.example .env
   ```

---

## 🚀 Execution Modes

### 1. One-Off Demo Mode (Simulated)
Runs the demo sequence locally (Scenario 1: rug pull shitcoin gets blocked, Scenario 2: stable ETH swap succeeds) using simulated prices, and then exits.
```bash
python agent.py
```

### 2. Live Chain Daemon Mode
Interacts with the deployed smart contracts on the Robinhood Testnet/Arbitrum Sepolia. The agent runs 24/7, fetching fresh CoinGecko price data and submitting transactions.
```bash
# Configure .env with live addresses and keys, then run:
LOOP_INTERVAL=60 PORT=8080 python agent.py
```

---

## 🌐 API Telemetry Server

When `LOOP_INTERVAL` is set to a positive integer, the agent starts a local **FastAPI** telemetry server. This allows the Veto Dashboard to read live execution metrics:

*   **`GET /health`**: Returns system health status, `DEMO_MODE`, and loop configurations.
*   **`GET /api/trades`**: Returns the cache of the latest 20 trade proposals (both executed and blocked).

---

## 🧪 Testing

The agent codebase is backed by full test coverage using `pytest`.

Run tests locally:
```bash
# Standard test run
pytest tests/

# Run tests with test coverage report
pytest --cov=. tests/
```

---

## ☁️ Railway Deployment

To run the agent 24/7 in the cloud:

1. **Create Service**: Add a new service on Railway connected to your repository.
2. **Set Root Directory**: In the service **Settings** -> **Build & Deploy** -> **Root Directory**, set it to `agent`.
3. **Configure Variables**:
    *   `DEMO_MODE`: `false` (or `true` to keep simulated loop)
    *   `RPC_URL`: Your RPC provider (Alchemy, QuickNode, etc.)
    *   `VETO_VAULT_ADDRESS`: The deployed `VetoVault` contract address.
    *   `RISK_ENGINE_ADDRESS`: The deployed WASM risk engine address.
    *   `AGENT_PRIVATE_KEY`: Private key for the EOA agent wallet.
    *   `LOOP_INTERVAL`: `60` (or your preferred execution frequency).
4. **Set Start Command**: Railway will auto-detect Python. In settings, set the **Start Command** to:
   ```bash
   python agent.py
   ```
