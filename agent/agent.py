"""
Veto — Autonomous Trading Agent

An AI agent that:
1. Monitors market conditions and identifies yield opportunities
2. Fetches historical prices from CoinGecko (or demo data)
3. Formats price arrays as on-chain calldata
4. Submits trade proposals to the Veto vault contract
5. The Stylus Risk Engine either APPROVES or BLOCKS the trade

The agent is intentionally aggressive — it WILL try to buy volatile assets.
This demonstrates that Veto physically prevents bad trades.

Usage:
    python agent.py                     # Demo mode (mock prices)
    DEMO_MODE=false python agent.py     # Live mode (CoinGecko + real chain)
"""

import os
import json
import sys
import time
import traceback
import threading
from web3 import Web3
from web3.exceptions import ContractLogicError
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import (
    RPC_URL,
    AGENT_PRIVATE_KEY,
    VAULT_ADDRESS,
    VAULT_ABI,
    DEMO_MODE,
    LOOP_INTERVAL,
    PORT,
)
from price_fetcher import get_prices_for_trade


def calculate_variance_bps(scaled_prices: list[int]) -> int:
    """Calculate variance in basis points using pure integer math, mirroring RiskEngine.rs."""
    n = len(scaled_prices)
    if n < 2:
        return 0
    mean = sum(scaled_prices) // n
    if mean == 0:
        return 0
    sum_sq_dev = sum((p - mean) ** 2 for p in scaled_prices)
    variance = sum_sq_dev // n
    scale = 100_000_000
    mean_sq = mean * mean
    variance_bps = (variance * scale) // mean_sq
    return variance_bps


TRADES_CACHE = []


def init_trades_cache():
    """Load existing trades from public/trades.json if available."""
    global TRADES_CACHE
    base_dir = os.path.dirname(os.path.abspath(__file__))
    trades_file = os.path.join(base_dir, "..", "dashboard", "public", "trades.json")
    if os.path.exists(trades_file):
        try:
            with open(trades_file, "r") as f:
                TRADES_CACHE = json.load(f)
                print(f"  Loaded {len(TRADES_CACHE)} trades from trades.json into memory cache.")
        except Exception as e:
            print(f"Error loading trades.json: {e}")


def log_trade_to_json(asset: str, status: str, variance_bps: int, threshold_bps: int, value: str, prices: list, tx_hash: str = ""):
    """Write/append a trade attempt to dashboard/public/trades.json and memory cache."""
    global TRADES_CACHE
    
    trade_id = len(TRADES_CACHE) + 1
    new_trade = {
        "id": trade_id,
        "txHash": tx_hash or f"0xmock{trade_id}",
        "asset": asset,
        "status": status,
        "varianceBps": variance_bps,
        "thresholdBps": threshold_bps,
        "value": value,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "prices": [float(p) for p in prices]
    }
    
    if tx_hash:
        TRADES_CACHE = [t for t in TRADES_CACHE if t.get("txHash") != tx_hash]
        
    TRADES_CACHE.append(new_trade)
    TRADES_CACHE = TRADES_CACHE[-20:]
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(base_dir, "..", "dashboard", "public")
    
    try:
        os.makedirs(public_dir, exist_ok=True)
        trades_file = os.path.join(public_dir, "trades.json")
        trades = []
        if os.path.exists(trades_file):
            try:
                with open(trades_file, "r") as f:
                    trades = json.load(f)
            except Exception:
                trades = []
                
        if tx_hash:
            trades = [t for t in trades if t.get("txHash") != tx_hash]
            
        trades.append(new_trade)
        trades = trades[-20:]
        
        with open(trades_file, "w") as f:
            json.dump(trades, f, indent=2)
        print(f"  Logged trade to dashboard/public/trades.json (hash: {new_trade['txHash'][:10]}...)")
    except Exception as e:
        print(f"Could not write to trades.json (filesystem may be read-only): {e}")


# Initialize the trades cache from file
init_trades_cache()

# Create FastAPI app
app = FastAPI(title="Veto Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/trades")
def get_trades():
    """Retrieve the latest 20 trades from memory."""
    global TRADES_CACHE
    return TRADES_CACHE


@app.get("/health")
def health_check():
    """Health check endpoint for Railway."""
    return {"status": "healthy", "demo_mode": DEMO_MODE, "loop_interval": LOOP_INTERVAL}


# ─── ANSI Colors for Terminal Output ───────────────────────────
RED = "\033[91m"
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def banner():
    """Print the agent startup banner."""
    print(f"""
{CYAN}{BOLD}╬══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ░█▀▀░█▀▀░█▀▀░▀█▀░█▀▀░█░█░█▀█░█░█░█░░░▀█▀                ║
║                 V   E   T   O                               ║
║                                                              ║
║   Autonomous Trading Agent — WASM Risk Engine                ║
║   "Your AI tried. Veto said no."                             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝{RESET}
""")


def print_step(step: int, msg: str):
    """Print a numbered step."""
    print(f"\n{CYAN}[Step {step}]{RESET} {msg}")


def print_success(msg: str):
    """Print a success message."""
    print(f"  {GREEN}✅ {msg}{RESET}")


def print_blocked(msg: str):
    """Print a blocked/rejected message."""
    print(f"\n{RED}{BOLD}  ╔══════════════════════════════════════════════════╗")
    print(f"  ║  🚨 TRANSACTION INTERCEPTED BY RISK ENGINE 🚨  ║")
    print(f"  ╠══════════════════════════════════════════════════╣")
    print(f"  ║  {msg:<48} ║")
    print(f"  ╚══════════════════════════════════════════════════╝{RESET}\n")


def print_approved(msg: str):
    """Print an approved message."""
    print(f"\n{GREEN}{BOLD}  ╔══════════════════════════════════════════════════╗")
    print(f"  ║  ✅ TRADE EXECUTED SUCCESSFULLY                  ║")
    print(f"  ╠══════════════════════════════════════════════════╣")
    print(f"  ║  {msg:<48} ║")
    print(f"  ╚══════════════════════════════════════════════════╝{RESET}\n")


def run_demo():
    """Run the demo sequence — shows both a blocked and approved trade."""
    banner()
    
    mode = "DEMO" if DEMO_MODE else "LIVE"
    print(f"{DIM}Mode: {mode} | RPC: {RPC_URL}{RESET}")
    
    if DEMO_MODE:
        print(f"{YELLOW}⚠️  Running in DEMO MODE — using mock prices and simulated transactions{RESET}")
        print(f"{DIM}   Set DEMO_MODE=false and configure .env for live chain interaction{RESET}")
        _run_demo_simulated()
    else:
        _run_live()


def _run_demo_simulated():
    """Simulated demo — no chain interaction needed."""
    
    # ── Scenario 1: Volatile shitcoin → BLOCKED ──
    print(f"\n{'═' * 60}")
    print(f"{RED}{BOLD}  SCENARIO 1: Agent discovers high-yield shitcoin{RESET}")
    print(f"{'═' * 60}")
    
    print_step(1, "Agent scanning markets for yield opportunities...")
    time.sleep(1)
    
    print_step(2, "High yield detected! 'RUGCOIN' pumping +400%")
    print(f"  {YELLOW}Agent reasoning: \"RUGCOIN has 10x APY on UniV3 pool.\"")
    print(f"  Agent decision: \"Allocating 2 ETH to RUGCOIN swap.\"{RESET}")
    time.sleep(0.5)
    
    print_step(3, "Fetching historical prices for RUGCOIN...")
    scaled, raw, meta = get_prices_for_trade("volatile")
    time.sleep(0.5)
    
    print_step(4, "Formatting price array as calldata...")
    print(f"  {DIM}Payload: {len(scaled)} prices × uint256, scaled ×10,000{RESET}")
    print(f"  {DIM}First 5: {scaled[:5]}{RESET}")
    time.sleep(0.5)
    
    print_step(5, "Submitting trade to Veto...")
    print(f"  {DIM}Target: 0xDEX...Router (UniswapV3)")
    print(f"  Value: 2.0 ETH")
    print(f"  Prices: {len(scaled)} data points{RESET}")
    time.sleep(1)
    
    print_step(6, "Veto → Stylus RiskEngine.checkVolatility()")
    print(f"  {DIM}Computing variance over {len(scaled)} prices...")
    print(f"  Mean: ${meta['mean']}")
    print(f"  Spread: {meta['spread_pct']}%")
    time.sleep(0.5)
    
    # Compute simulated variance
    mean_scaled = sum(scaled) / len(scaled)
    sum_sq = sum((p - mean_scaled) ** 2 for p in scaled)
    variance = sum_sq / len(scaled)
    if mean_scaled > 0:
        var_bps = int((variance * 100_000_000) / (mean_scaled * mean_scaled))
    else:
        var_bps = 999999
    
    print(f"  Computed variance: {var_bps} bps")
    print(f"  Threshold: 1000 bps{RESET}")
    time.sleep(0.5)
    
    log_trade_to_json("RUGCOIN", "blocked", var_bps, 1000, "2.0 ETH", raw, f"0xmock_blocked_{int(time.time())}")
    print_blocked(f"Variance {var_bps} bps > 1000 bps limit")
    print(f"  {RED}Custom Error: VolatilityExceedsThreshold({var_bps}, 1000)")
    print(f"  Result: Transaction REVERTED. Funds SAFE. ✅{RESET}")
    
    time.sleep(2)
    
    # ── Scenario 2: Stable ETH → APPROVED ──
    print(f"\n{'═' * 60}")
    print(f"{GREEN}{BOLD}  SCENARIO 2: Agent trades stable Ethereum{RESET}")
    print(f"{'═' * 60}")
    
    print_step(1, "Agent scanning markets for yield opportunities...")
    time.sleep(1)
    
    print_step(2, "Moderate yield detected! ETH staking pool at 4.2% APY")
    print(f"  {CYAN}Agent reasoning: \"ETH staking has consistent yield with low variance.\"")
    print(f"  Agent decision: \"Allocating 1 ETH to staking pool.\"{RESET}")
    time.sleep(0.5)
    
    print_step(3, "Fetching historical prices for ETH...")
    scaled_s, raw_s, meta_s = get_prices_for_trade("ethereum")
    time.sleep(0.5)
    
    print_step(4, "Formatting price array as calldata...")
    print(f"  {DIM}Payload: {len(scaled_s)} prices × uint256, scaled ×10,000{RESET}")
    time.sleep(0.5)
    
    print_step(5, "Submitting trade to Veto...")
    print(f"  {DIM}Target: 0xStak...Pool (Lido)")
    print(f"  Value: 1.0 ETH")
    print(f"  Prices: {len(scaled_s)} data points{RESET}")
    time.sleep(1)
    
    print_step(6, "Veto → Stylus RiskEngine.checkVolatility()")
    mean_s = sum(scaled_s) / len(scaled_s)
    sum_sq_s = sum((p - mean_s) ** 2 for p in scaled_s)
    var_s = sum_sq_s / len(scaled_s)
    var_bps_s = int((var_s * 100_000_000) / (mean_s * mean_s)) if mean_s > 0 else 0
    
    print(f"  {DIM}Computing variance over {len(scaled_s)} prices...")
    print(f"  Mean: ${meta_s['mean']}")
    print(f"  Spread: {meta_s['spread_pct']}%")
    print(f"  Computed variance: {var_bps_s} bps")
    print(f"  Threshold: 1000 bps{RESET}")
    time.sleep(0.5)
    
    tx_hash_sim = f"0xmock_success_{int(time.time())}"
    log_trade_to_json("ETH", "executed", var_bps_s, 1000, "1.0 ETH", raw_s, tx_hash_sim)
    print_approved(f"Variance {var_bps_s} bps ≤ 1000 bps limit")
    print(f"  {GREEN}Trade executed on-chain. 1 ETH → staking pool.")
    print(f"  Tx hash: {tx_hash_sim} (simulated){RESET}")
    
    # ── Summary ──
    print(f"\n{'═' * 60}")
    print(f"{CYAN}{BOLD}  SUMMARY{RESET}")
    print(f"{'═' * 60}")
    print(f"  Trades attempted: 2")
    print(f"  {GREEN}Trades executed:  1 (ETH staking){RESET}")
    print(f"  {RED}Trades blocked:   1 (RUGCOIN — too volatile){RESET}")
    print(f"  {CYAN}Funds saved:      2.0 ETH (would have been lost to rug pull){RESET}")
    print(f"\n  {DIM}\"Veto. We let the AI trade, but we let Rust do the math.\"{RESET}\n")


def _run_live():
    """Live mode — interacts with actual deployed contracts."""
    
    if not VAULT_ADDRESS or not AGENT_PRIVATE_KEY:
        print(f"{RED}Error: VETO_VAULT_ADDRESS and AGENT_PRIVATE_KEY required for live mode{RESET}")
        print(f"{DIM}Configure .env file — see .env.example{RESET}")
        sys.exit(1)
    
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        print(f"{RED}Error: Cannot connect to RPC at {RPC_URL}{RESET}")
        sys.exit(1)
    
    print_success(f"Connected to chain (ID: {w3.eth.chain_id})")
    
    account = w3.eth.account.from_key(AGENT_PRIVATE_KEY)
    vault = w3.eth.contract(
        address=Web3.to_checksum_address(VAULT_ADDRESS),
        abi=VAULT_ABI,
    )
    
    # Read current state
    threshold = vault.functions.volatilityThresholdBps().call()
    balance = vault.functions.balance().call()
    executed, blocked = vault.functions.stats().call()
    
    print(f"  Vault: {VAULT_ADDRESS}")
    print(f"  Agent: {account.address}")
    print(f"  Balance: {Web3.from_wei(balance, 'ether')} ETH")
    print(f"  Threshold: {threshold} bps")
    print(f"  Stats: {executed} executed, {blocked} blocked")
    
    # Use agent address as dummy target. Calling an EOA with empty data always succeeds.
    target = account.address
    
    # ── Scenario 1: Volatile trade (should fail/revert on-chain) ──
    print(f"\n{'═' * 60}")
    print(f"{RED}{BOLD}  SCENARIO 1: Submitting volatile trade to Veto (should revert){RESET}")
    print(f"{'═' * 60}")
    
    print_step(1, "Fetching prices for volatile asset...")
    scaled_v, raw_v, meta_v = get_prices_for_trade("volatile")
    
    print_step(2, "Submitting volatile trade to Veto...")
    try:
        tx_v = vault.functions.executeTrade(
            Web3.to_checksum_address(target),
            b"",  # empty calldata
            0,    # 0 ETH value
            scaled_v,
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 3_000_000,
            "gasPrice": int(w3.eth.gas_price * 1.2),  # bump gas price slightly to ensure quick inclusion
        })
        
        signed_v = w3.eth.account.sign_transaction(tx_v, AGENT_PRIVATE_KEY)
        tx_hash_v = w3.eth.send_raw_transaction(signed_v.raw_transaction)
        print(f"  {DIM}Transaction sent. Hash: {tx_hash_v.hex()}{RESET}")
        print(f"  {DIM}Waiting for confirmation...{RESET}")
        receipt_v = w3.eth.wait_for_transaction_receipt(tx_hash_v, timeout=60)
        
        var_bps_v = calculate_variance_bps(scaled_v)
        if receipt_v["status"] == 1:
            print_approved(f"Volatile trade executed successfully? (Unexpected) Tx: {tx_hash_v.hex()}")
            log_trade_to_json("RUGCOIN", "executed", var_bps_v, threshold, "0.0 ETH", raw_v, tx_hash_v.hex())
        else:
            print_blocked(f"Volatility check failed. Transaction reverted on-chain. Hash: {tx_hash_v.hex()}")
            log_trade_to_json("RUGCOIN", "blocked", var_bps_v, threshold, "0.0 ETH", raw_v, tx_hash_v.hex())
            
    except ContractLogicError as e:
        error_msg = str(e)
        var_bps_v = calculate_variance_bps(scaled_v)
        if "VolatilityExceedsThreshold" in error_msg:
            print_blocked(f"Risk Engine blocked: {error_msg}")
            log_trade_to_json("RUGCOIN", "blocked", var_bps_v, threshold, "0.0 ETH", raw_v, f"0xreverted_before_send_{int(time.time())}")
        else:
            print(f"{RED}Contract error: {error_msg}{RESET}")
    except Exception as e:
        print(f"{RED}Error: {e}{RESET}")
        traceback.print_exc()

    # ── Scenario 2: Stable trade (should succeed on-chain) ──
    print(f"\n{'═' * 60}")
    print(f"{GREEN}{BOLD}  SCENARIO 2: Submitting stable trade to Veto (should succeed){RESET}")
    print(f"{'═' * 60}")
    
    print_step(1, "Fetching prices for stable asset...")
    scaled_s, raw_s, meta_s = get_prices_for_trade("ethereum")
    
    print_step(2, "Submitting stable trade to Veto...")
    try:
        tx_s = vault.functions.executeTrade(
            Web3.to_checksum_address(target),
            b"",  # empty calldata
            0,    # 0 ETH value
            scaled_s,
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 3_000_000,
            "gasPrice": int(w3.eth.gas_price * 1.2),  # bump gas price slightly
        })
        
        signed_s = w3.eth.account.sign_transaction(tx_s, AGENT_PRIVATE_KEY)
        tx_hash_s = w3.eth.send_raw_transaction(signed_s.raw_transaction)
        print(f"  {DIM}Transaction sent. Hash: {tx_hash_s.hex()}{RESET}")
        print(f"  {DIM}Waiting for confirmation...{RESET}")
        receipt_s = w3.eth.wait_for_transaction_receipt(tx_hash_s, timeout=60)
        
        var_bps_s = calculate_variance_bps(scaled_s)
        if receipt_s["status"] == 1:
            print_approved(f"Stable trade executed on-chain. Tx: {tx_hash_s.hex()}")
            log_trade_to_json("ETH", "executed", var_bps_s, threshold, "0.0 ETH", raw_s, tx_hash_s.hex())
        else:
            print_blocked(f"Stable trade reverted on-chain. Hash: {tx_hash_s.hex()}")
            log_trade_to_json("ETH", "blocked", var_bps_s, threshold, "0.0 ETH", raw_s, tx_hash_s.hex())
            
    except ContractLogicError as e:
        print(f"{RED}Contract error: {e}{RESET}")
    except Exception as e:
        print(f"{RED}Error: {e}{RESET}")
        traceback.print_exc()

    # Read final state
    executed_f, blocked_f = vault.functions.stats().call()
    print(f"\n{'═' * 60}")
    print(f"{CYAN}{BOLD}  FINAL STATE{RESET}")
    print(f"{'═' * 60}")
    print(f"  Executed trades: {executed_f} (change: +{executed_f - executed})")
    print(f"  Blocked trades:  {blocked_f} (change: +{blocked_f - blocked})")
    print(f"  (Note: blocked trades revert, so their state changes roll back, but they are recorded on-chain as reverted txs)")


def agent_loop():
    """Run the agent loop continuously."""
    print(f"[AgentLoop] Starting agent loop with interval {LOOP_INTERVAL}s")
    # Wait a bit before first execution to let the web server start up
    time.sleep(2)
    while True:
        try:
            print("\n" + "=" * 60)
            print(f"[AgentLoop] Starting agent cycle at {time.strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 60)
            if DEMO_MODE:
                _run_demo_simulated()
            else:
                _run_live()
            print(f"[AgentLoop] Cycle complete. Sleeping for {LOOP_INTERVAL}s...")
        except Exception as e:
            print(f"[AgentLoop] Error in cycle: {e}")
            traceback.print_exc()
        time.sleep(LOOP_INTERVAL)


if __name__ == "__main__":  # pragma: no cover
    if LOOP_INTERVAL > 0:
        # Start background agent loop
        t = threading.Thread(target=agent_loop, daemon=True)
        t.start()
        # Start FastAPI server
        import uvicorn
        print(f"Starting FastAPI API server on port {PORT}...")
        uvicorn.run(app, host="0.0.0.0", port=PORT)
    else:
        run_demo()
