.PHONY: test-all coverage-all test-solidity coverage-solidity test-stylus coverage-stylus test-agent coverage-agent test-dashboard coverage-dashboard setup-stylus-cov deploy demo clean ci

test-all: test-solidity test-stylus test-agent test-dashboard

coverage-all: coverage-solidity coverage-stylus coverage-agent coverage-dashboard

ci: coverage-solidity coverage-stylus coverage-agent coverage-dashboard
	cd dashboard && npm run lint && npm run typecheck && npm run build


# Solidity
test-solidity:
	cd contracts/solidity && forge test

coverage-solidity:
	cd contracts/solidity && forge coverage

# Stylus
test-stylus:
	cd contracts/stylus && cargo test --features stylus-test

setup-stylus-cov:
	@if ! cargo llvm-cov --version >/dev/null 2>&1; then \
		echo "cargo-llvm-cov not found, installing..."; \
		cargo install cargo-llvm-cov; \
	fi

coverage-stylus: setup-stylus-cov
	cd contracts/stylus && cargo llvm-cov --features stylus-test

# Agent
test-agent:
	cd agent && . .venv/bin/activate && python3 -m pytest tests/

coverage-agent:
	cd agent && . .venv/bin/activate && python3 -m pytest --cov=. --cov-report=term-missing --cov-fail-under=100 tests/

# Dashboard
test-dashboard:
	cd dashboard && npm run test

coverage-dashboard:
	cd dashboard && npm run test:coverage

# ── Deploy & Demo ─────────────────────────────────────────────
deploy:
	./scripts/deploy.sh

demo:
	./scripts/demo.sh

demo-live:
	./scripts/demo.sh --live

# ── Cleanup ──────────────────────────────────────────────────
clean:
	rm -rf contracts/solidity/out contracts/solidity/cache
	rm -rf contracts/stylus/target
	rm -rf dashboard/.next dashboard/tsconfig.tsbuildinfo
	rm -rf agent/__pycache__ agent/.pytest_cache
