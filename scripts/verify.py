import os
import sys
from web3 import Web3
from dotenv import load_dotenv

# Find root dir
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT_DIR, "agent", ".env"))

RPC_URL = os.getenv("RPC_URL")
VAULT_ADDRESS = os.getenv("VETO_VAULT_ADDRESS")

if not RPC_URL or not VAULT_ADDRESS:
    print("Error: RPC_URL or VETO_VAULT_ADDRESS not found in agent/.env")
    sys.exit(1)

w3 = Web3(Web3.HTTPProvider(RPC_URL))
if not w3.is_connected():
    print(f"Error: Failed to connect to RPC at {RPC_URL}")
    sys.exit(1)

abi = [
    {"inputs": [], "name": "owner", "outputs": [{"type": "address"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "agent", "outputs": [{"type": "address"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "riskEngine", "outputs": [{"type": "address"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "volatilityThresholdBps", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "tradesExecuted", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "tradesBlocked", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"}
]

try:
    contract = w3.eth.contract(address=Web3.to_checksum_address(VAULT_ADDRESS), abi=abi)
    
    owner = contract.functions.owner().call()
    agent = contract.functions.agent().call()
    risk_engine = contract.functions.riskEngine().call()
    threshold = contract.functions.volatilityThresholdBps().call()
    executed = contract.functions.tradesExecuted().call()
    blocked = contract.functions.tradesBlocked().call()
    
    balance_wei = w3.eth.get_balance(Web3.to_checksum_address(VAULT_ADDRESS))
    balance_eth = w3.from_wei(balance_wei, "ether")
    
    print("\n" + "="*60)
    print(" VETO VAULT ON-CHAIN VERIFICATION")
    print("="*60)
    print(f"Vault Address:      {VAULT_ADDRESS}")
    print(f"RPC URL:            {RPC_URL}")
    print(f"Network Connected:  True (Chain ID: {w3.eth.chain_id})")
    print("-"*60)
    print(f"Vault Owner:        {owner}")
    print(f"Authorized Agent:   {agent}")
    print(f"Risk Engine (WASM): {risk_engine}")
    print(f"Vol Threshold:      {threshold} bps ({(threshold / 100):.2f}%)")
    print(f"Vault Balance:      {balance_eth} ETH")
    print("-"*60)
    print(f"On-chain Executed:  {executed}")
    print(f"On-chain Blocked:   {blocked} (reverts roll back this counter on-chain)")
    print("="*60 + "\n")
    
except Exception as e:
    print(f"Error querying contract: {e}")
    sys.exit(1)
