"""
Veto Agent Configuration
Shared constants, ABI fragments, and contract configuration.
"""

import json
import os
from dotenv import load_dotenv

load_dotenv()

# ─── Environment ───────────────────────────────────────────────

RPC_URL = os.getenv("RPC_URL", "https://rpc.testnet.chain.robinhood.com")
AGENT_PRIVATE_KEY = os.getenv("AGENT_PRIVATE_KEY", "")
VAULT_ADDRESS = os.getenv("VETO_VAULT_ADDRESS", "")
RISK_ENGINE_ADDRESS = os.getenv("RISK_ENGINE_ADDRESS", "")
COINGECKO_API_URL = os.getenv("COINGECKO_API_URL", "https://api.coingecko.com/api/v3")
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"

# ─── Price Scaling ─────────────────────────────────────────────

# All prices are multiplied by this before sending on-chain
# $3,241.57 → 32_415_700
PRICE_SCALE = 10_000

# ─── ABI Fragments ─────────────────────────────────────────────

# Veto.sol — only the methods the agent calls
VAULT_ABI = json.loads("""[
    {
        "inputs": [
            {"name": "target", "type": "address"},
            {"name": "data", "type": "bytes"},
            {"name": "value", "type": "uint256"},
            {"name": "prices", "type": "uint256[]"}
        ],
        "name": "executeTrade",
        "outputs": [{"name": "", "type": "bytes"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "volatilityThresholdBps",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "balance",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "stats",
        "outputs": [
            {"name": "executed", "type": "uint256"},
            {"name": "blocked", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "computedBps", "type": "uint256"},
            {"name": "thresholdBps", "type": "uint256"}
        ],
        "name": "VolatilityExceedsThreshold",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "name": "agent", "type": "address"},
            {"indexed": true, "name": "target", "type": "address"},
            {"indexed": false, "name": "value", "type": "uint256"},
            {"indexed": false, "name": "variance", "type": "uint256"},
            {"indexed": false, "name": "threshold", "type": "uint256"}
        ],
        "name": "TradeBlocked",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "name": "agent", "type": "address"},
            {"indexed": true, "name": "target", "type": "address"},
            {"indexed": false, "name": "value", "type": "uint256"},
            {"indexed": false, "name": "variance", "type": "uint256"},
            {"indexed": false, "name": "threshold", "type": "uint256"}
        ],
        "name": "TradeExecuted",
        "type": "event"
    }
]""")

# ─── Demo Price Sets ───────────────────────────────────────────

# Stable BTC prices (±0.5%) — should PASS volatility check
DEMO_STABLE_PRICES_USD = [
    3241.57, 3238.22, 3245.10, 3240.88, 3236.75,
    3242.30, 3239.50, 3244.15, 3237.90, 3241.00,
    3243.20, 3238.80, 3240.50, 3242.75, 3239.10,
    3241.35, 3237.60, 3244.90, 3240.20, 3238.45,
    3243.70, 3239.85, 3241.50, 3236.30, 3242.60,
    3240.10, 3238.70, 3244.40, 3241.90, 3237.15,
    3243.05, 3239.25, 3240.80, 3242.40, 3238.10,
    3241.70, 3237.40, 3244.60, 3240.55, 3239.00,
    3243.45, 3238.50, 3241.20, 3236.90, 3242.80,
    3240.30, 3238.95, 3244.25, 3241.60, 3237.50,
]

# Volatile shitcoin prices (pump & dump) — should FAIL volatility check
DEMO_VOLATILE_PRICES_USD = [
    0.50, 1.20, 0.30, 2.50, 0.10,
    5.00, 0.80, 0.15, 3.20, 0.05,
    8.00, 0.40, 0.08, 4.50, 0.02,
    12.00, 0.60, 0.03, 6.00, 0.01,
    15.00, 0.25, 0.04, 7.50, 0.03,
    20.00, 0.10, 0.02, 9.00, 0.01,
    25.00, 0.08, 0.01, 11.00, 0.005,
    30.00, 0.05, 0.01, 13.00, 0.003,
    35.00, 0.03, 0.005, 15.00, 0.002,
    40.00, 0.02, 0.003, 17.00, 0.001,
]


def scale_prices(prices_usd: list[float]) -> list[int]:
    """Convert USD prices to on-chain fixed-point integers.
    
    $3,241.57 → 32_415_700 (× 10,000)
    
    Args:
        prices_usd: List of prices in USD (float)
        
    Returns:
        List of scaled prices as integers
    """
    return [int(p * PRICE_SCALE) for p in prices_usd]
