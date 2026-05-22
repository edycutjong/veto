#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Veto — Verification Script
# Activates the agent python environment and runs verify.py to
# check deployed contract status on-chain.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_DIR="$ROOT_DIR/agent"

# Ensure venv exists and activate
if [[ ! -d "$AGENT_DIR/.venv" ]]; then
  echo "Python virtual environment not found. Please run scripts/demo.sh or setup dependencies."
  exit 1
fi

source "$AGENT_DIR/.venv/bin/activate"
python3 "$ROOT_DIR/scripts/verify.py"
