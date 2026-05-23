#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Veto — Full Deployment Script
# Deploys both contracts and wires the agent in one shot.
#
# Usage:
#   ./scripts/deploy.sh                          # uses .env defaults
#   RPC_URL=... PRIVATE_KEY=... ./scripts/deploy.sh   # override
#
# Prerequisites:
#   - forge    (Foundry)
#   - cargo-stylus
#   - cast     (Foundry)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── ANSI Colors ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Load .env if it exists ───────────────────────────────────
if [[ -f "$ROOT_DIR/agent/.env" ]]; then
  set -a
  source "$ROOT_DIR/agent/.env"
  set +a
fi

# ── Configuration ────────────────────────────────────────────
RPC_URL="${RPC_URL:-https://rpc.testnet.chain.robinhood.com}"
PRIVATE_KEY="${PRIVATE_KEY:-}"
AGENT_PRIVATE_KEY="${AGENT_PRIVATE_KEY:-}"
THRESHOLD_BPS="${THRESHOLD_BPS:-1000}"  # 10% default
FUND_AMOUNT="${FUND_AMOUNT:-0.01ether}"

# If PRIVATE_KEY is not passed, see if there is one configured
if [[ -z "$PRIVATE_KEY" ]]; then
  # Try to read AGENT_PRIVATE_KEY from environment/loaded env
  PRIVATE_KEY="${AGENT_PRIVATE_KEY:-}"
fi

if [[ -z "$PRIVATE_KEY" ]]; then
  echo -e "${RED}Error: PRIVATE_KEY or AGENT_PRIVATE_KEY is required.${RESET}"
  echo -e "${DIM}Set it in agent/.env or pass as env var:${RESET}"
  echo -e "  PRIVATE_KEY=0x... ./scripts/deploy.sh"
  exit 1
fi

if [[ -z "$AGENT_PRIVATE_KEY" ]]; then
  AGENT_PRIVATE_KEY="$PRIVATE_KEY"
fi

# Derive the addresses
DEPLOYER=$(cast wallet address "$PRIVATE_KEY" 2>/dev/null)
AGENT_ADDRESS=$(cast wallet address "$AGENT_PRIVATE_KEY" 2>/dev/null)

echo -e ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║               V E T O   —   D E P L O Y                 ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo -e ""
echo -e "  ${DIM}RPC:        ${RPC_URL}${RESET}"
echo -e "  ${DIM}Owner:      ${DEPLOYER}${RESET}"
echo -e "  ${DIM}Agent:      ${AGENT_ADDRESS}${RESET}"
echo -e "  ${DIM}Threshold:  ${THRESHOLD_BPS} bps${RESET}"
echo -e ""

# ─────────────────────────────────────────────────────────────
# STEP 1: Deploy Stylus Risk Engine (Rust/WASM)
# ─────────────────────────────────────────────────────────────
echo -e "${CYAN}[Step 1/5]${RESET} Deploying Stylus Risk Engine (WASM)..."

cd "$ROOT_DIR/contracts/stylus"

# Check contract compiles
echo -e "  ${DIM}Checking WASM compilation...${RESET}"
cargo stylus check --endpoint "$RPC_URL" 2>&1 | tail -1

# Deploy
STYLUS_OUTPUT=$(cargo stylus deploy \
  --endpoint "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --no-verify \
  --max-fee-per-gas-gwei 0.1 \
  2>&1)

RISK_ENGINE_ADDRESS=$(echo "$STYLUS_OUTPUT" | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)

if [[ -z "$RISK_ENGINE_ADDRESS" ]]; then
  echo -e "${RED}Failed to extract RiskEngine address from deploy output:${RESET}"
  echo "$STYLUS_OUTPUT"
  exit 1
fi

echo -e "  ${GREEN}✅ RiskEngine deployed: ${RISK_ENGINE_ADDRESS}${RESET}"

# ─────────────────────────────────────────────────────────────
# STEP 2: Deploy Solidity VetoVault
# ─────────────────────────────────────────────────────────────
echo -e ""
echo -e "${CYAN}[Step 2/5]${RESET} Deploying VetoVault (Solidity/EVM)..."

cd "$ROOT_DIR/contracts/solidity"

FORGE_OUTPUT=$(forge create src/VetoVault.sol:VetoVault \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --constructor-args "$RISK_ENGINE_ADDRESS" "$THRESHOLD_BPS" \
  2>&1)

VAULT_ADDRESS=$(echo "$FORGE_OUTPUT" | grep "Deployed to:" | grep -oE '0x[a-fA-F0-9]{40}')

if [[ -z "$VAULT_ADDRESS" ]]; then
  echo -e "${RED}Failed to extract VetoVault address from deploy output:${RESET}"
  echo "$FORGE_OUTPUT"
  exit 1
fi

echo -e "  ${GREEN}✅ VetoVault deployed: ${VAULT_ADDRESS}${RESET}"

# ─────────────────────────────────────────────────────────────
# STEP 3: Register the agent on the vault
# ─────────────────────────────────────────────────────────────
echo -e ""
echo -e "${CYAN}[Step 3/5]${RESET} Registering agent wallet on vault..."

cast send "$VAULT_ADDRESS" "setAgent(address)" "$AGENT_ADDRESS" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  > /dev/null 2>&1

echo -e "  ${GREEN}✅ Agent registered: ${AGENT_ADDRESS}${RESET}"

# Whitelist the agent address as a target so demo/simulated transfers can succeed
cast send "$VAULT_ADDRESS" "setTargetWhitelist(address,bool)" "$AGENT_ADDRESS" true \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  > /dev/null 2>&1

echo -e "  ${GREEN}✅ Agent address whitelisted as target: ${AGENT_ADDRESS}${RESET}"

# ─────────────────────────────────────────────────────────────
# STEP 4: Fund the vault
# ─────────────────────────────────────────────────────────────
echo -e ""
echo -e "${CYAN}[Step 4/5]${RESET} Funding vault with ${FUND_AMOUNT}..."

cast send "$VAULT_ADDRESS" --value "$FUND_AMOUNT" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  > /dev/null 2>&1

BALANCE=$(cast call "$VAULT_ADDRESS" "balance()(uint256)" --rpc-url "$RPC_URL" 2>/dev/null || echo "unknown")

echo -e "  ${GREEN}✅ Vault funded. Balance: ${BALANCE} wei${RESET}"

# ─────────────────────────────────────────────────────────────
# STEP 5: Write environment files
# ─────────────────────────────────────────────────────────────
echo -e ""
echo -e "${CYAN}[Step 5/5]${RESET} Writing environment files..."

cat > "$ROOT_DIR/agent/.env" <<EOF
# ── Auto-generated by scripts/deploy.sh ──────────────────────
# Deployed at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

DEMO_MODE=false

# ── Robinhood Chain ──────────────────────────────────────────
RPC_URL=${RPC_URL}

# ── Contract Addresses ───────────────────────────────────────
VETO_VAULT_ADDRESS=${VAULT_ADDRESS}
RISK_ENGINE_ADDRESS=${RISK_ENGINE_ADDRESS}

# ── Agent Wallet ─────────────────────────────────────────────
AGENT_PRIVATE_KEY=${AGENT_PRIVATE_KEY}

# ── Price Data ───────────────────────────────────────────────
COINGECKO_API_URL=https://api.coingecko.com/api/v3
EOF

echo -e "  ${GREEN}✅ agent/.env written${RESET}"

cat > "$ROOT_DIR/dashboard/.env.local" <<EOF
# ── Auto-generated by scripts/deploy.sh ──────────────────────
# Deployed at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

NEXT_PUBLIC_RPC_URL=${RPC_URL}
NEXT_PUBLIC_VAULT_ADDRESS=${VAULT_ADDRESS}
NEXT_PUBLIC_RISK_ENGINE_ADDRESS=${RISK_ENGINE_ADDRESS}
EOF

echo -e "  ${GREEN}✅ dashboard/.env.local written${RESET}"

# ── Summary ──────────────────────────────────────────────────
echo -e ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║               D E P L O Y   C O M P L E T E             ║${RESET}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${RESET}"
echo -e "${GREEN}${BOLD}║${RESET}  RiskEngine:  ${RISK_ENGINE_ADDRESS}  ${GREEN}${BOLD}║${RESET}"
echo -e "${GREEN}${BOLD}║${RESET}  VetoVault:   ${VAULT_ADDRESS}  ${GREEN}${BOLD}║${RESET}"
echo -e "${GREEN}${BOLD}║${RESET}  Owner:       ${DEPLOYER}  ${GREEN}${BOLD}║${RESET}"
echo -e "${GREEN}${BOLD}║${RESET}  Agent:       ${AGENT_ADDRESS}  ${GREEN}${BOLD}║${RESET}"
echo -e "${GREEN}${BOLD}║${RESET}  Threshold:   ${THRESHOLD_BPS} bps                              ${GREEN}${BOLD}║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo -e ""
echo -e "  ${CYAN}Next: make demo${RESET}"
echo -e ""
