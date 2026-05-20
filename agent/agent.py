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

import json
import sys
import time
import traceback
from web3 import Web3
from web3.exceptions import ContractLogicError

from config import (
    RPC_URL,
    AGENT_PRIVATE_KEY,
    VAULT_ADDRESS,
    VAULT_ABI,
    DEMO_MODE,
)
from price_fetcher import get_prices_for_trade


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
    
    print_approved(f"Variance {var_bps_s} bps ≤ 1000 bps limit")
    print(f"  {GREEN}Trade executed on-chain. 1 ETH → staking pool.")
    print(f"  Tx hash: 0x{'a1b2c3d4' * 8} (simulated){RESET}")
    
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
        print(f"{RED}Error: AEGIS_VAULT_ADDRESS and AGENT_PRIVATE_KEY required for live mode{RESET}")
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
    
    # Attempt a trade with volatile prices
    print_step(1, "Fetching prices for test asset...")
    scaled, raw, meta = get_prices_for_trade("volatile")
    
    print_step(2, "Submitting trade to Veto...")
    
    # Use a dummy target (address(1)) with empty calldata for demo
    target = "0x0000000000000000000000000000000000000001"
    
    try:
        tx = vault.functions.executeTrade(
            Web3.to_checksum_address(target),
            b"",  # empty calldata
            0,    # 0 ETH value
            scaled,
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 3_000_000,
            "gasPrice": w3.eth.gas_price,
        })
        
        signed = w3.eth.account.sign_transaction(tx, AGENT_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        
        if receipt["status"] == 1:
            print_approved(f"Tx: {tx_hash.hex()}")
        else:
            print_blocked("Transaction reverted on-chain")
            
    except ContractLogicError as e:
        error_msg = str(e)
        if "VolatilityExceedsThreshold" in error_msg:
            print_blocked(f"Risk Engine blocked: {error_msg}")
        else:
            print(f"{RED}Contract error: {error_msg}{RESET}")
    except Exception as e:
        print(f"{RED}Error: {e}{RESET}")
        traceback.print_exc()


if __name__ == "__main__":
    run_demo()
