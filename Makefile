.DEFAULT_GOAL := ci

.PHONY: all ci lint test build coverage setup deploy demo demo-live clean help \
        test-solidity test-stylus test-agent test-dashboard \
        coverage-solidity coverage-stylus coverage-agent coverage-dashboard \
        setup-stylus-cov

# ── CI (default) ──────────────────────────────────────────────
# Running `make` or `make ci` runs the full validation pipeline.

all: ci

ci: lint test build
	@echo ""
	@echo "✓ All checks passed."

# ── Lint & Type Check ─────────────────────────────────────────

lint:
	cd dashboard && npm run lint && npm run typecheck

# ── Tests ─────────────────────────────────────────────────────

test: test-solidity test-stylus test-agent test-dashboard

test-solidity:
	cd contracts/solidity && forge test -vvv

test-stylus:
	cd contracts/stylus && cargo test --features stylus-test

test-agent:
	cd agent && . .venv/bin/activate && python3 -m pytest tests/ -v

test-dashboard:
	cd dashboard && npm run test -- --ci

# ── Build ─────────────────────────────────────────────────────

build:
	cd dashboard && npm run build

# ── Coverage ──────────────────────────────────────────────────

coverage: coverage-solidity coverage-stylus coverage-agent coverage-dashboard

coverage-solidity:
	cd contracts/solidity && forge coverage

setup-stylus-cov:
	@if ! cargo llvm-cov --version >/dev/null 2>&1; then \
		echo "Installing cargo-llvm-cov..."; \
		cargo install cargo-llvm-cov; \
	fi

coverage-stylus: setup-stylus-cov
	cd contracts/stylus && cargo llvm-cov --features stylus-test

coverage-agent:
	cd agent && . .venv/bin/activate && python3 -m pytest --cov=. --cov-report=term-missing tests/

coverage-dashboard:
	cd dashboard && npm run test:coverage

# ── Setup ─────────────────────────────────────────────────────

setup:
	cd dashboard && npm install
	cd agent && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

# ── Deploy & Demo ─────────────────────────────────────────────

deploy:
	./scripts/deploy.sh

demo:
	./scripts/demo.sh

demo-live:
	./scripts/demo.sh --live

# ── Cleanup ───────────────────────────────────────────────────

clean:
	rm -rf contracts/solidity/out contracts/solidity/cache
	rm -rf contracts/stylus/target
	rm -rf dashboard/.next dashboard/tsconfig.tsbuildinfo
	rm -rf agent/__pycache__ agent/.pytest_cache

# ── Help ──────────────────────────────────────────────────────

help:
	@echo ""
	@echo "Veto — Makefile targets"
	@echo ""
	@echo "  make              Full CI pipeline (lint + test + build)"
	@echo "  make ci           Same as above"
	@echo "  make lint         ESLint + TypeScript check (dashboard)"
	@echo "  make test         All tests (Solidity + Rust + Python + Jest)"
	@echo "  make build        Build dashboard production bundle"
	@echo "  make coverage     All coverage reports"
	@echo ""
	@echo "  Individual tests:"
	@echo "  make test-solidity    forge test -vvv (39 tests)"
	@echo "  make test-stylus      cargo test --features stylus-test"
	@echo "  make test-agent       pytest tests/"
	@echo "  make test-dashboard   jest --ci"
	@echo ""
	@echo "  make setup        Install all dependencies (npm + pip)"
	@echo "  make deploy       Deploy contracts via scripts/deploy.sh"
	@echo "  make demo         Run local demo simulation"
	@echo "  make demo-live    Run live chain demo"
	@echo "  make clean        Remove all build artifacts"
	@echo ""
