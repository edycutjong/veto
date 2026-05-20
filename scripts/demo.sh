#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Veto — Demo Runner
# Runs the AI trading agent in demo mode.
#
# Usage:
#   ./scripts/demo.sh                # Demo mode (default)
#   ./scripts/demo.sh --live         # Live mode (requires deployed contracts)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_DIR="$ROOT_DIR/agent"

# ── ANSI Colors ──────────────────────────────────────────────
CYAN='\033[0;36m'
DIM='\033[2m'
RESET='\033[0m'

# ── Parse args ───────────────────────────────────────────────
LIVE_MODE=false
if [[ "${1:-}" == "--live" ]]; then
  LIVE_MODE=true
fi

# ── Ensure venv exists ───────────────────────────────────────
if [[ ! -d "$AGENT_DIR/.venv" ]]; then
  echo -e "${CYAN}Creating Python venv...${RESET}"
  python3 -m venv "$AGENT_DIR/.venv"
  source "$AGENT_DIR/.venv/bin/activate"
  pip install -r "$AGENT_DIR/requirements.txt" -q
else
  source "$AGENT_DIR/.venv/bin/activate"
fi

# ── Run ──────────────────────────────────────────────────────
if [[ "$LIVE_MODE" == true ]]; then
  echo -e "${CYAN}Running agent in LIVE mode...${RESET}"
  echo -e "${DIM}Ensure agent/.env has deployed contract addresses.${RESET}"
  DEMO_MODE=false python3 "$AGENT_DIR/agent.py"
else
  echo -e "${CYAN}Running agent in DEMO mode...${RESET}"
  DEMO_MODE=true python3 "$AGENT_DIR/agent.py"
fi
