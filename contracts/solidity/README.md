# Veto — Solidity Contracts

EVM layer of the Veto execution sandbox. Handles fund custody, access control, and cross-contract calls to the Stylus WASM risk engine.

## Contracts

| Contract | Purpose |
|---|---|
| `VetoVault.sol` | Main vault — holds funds, intercepts agent trades, calls risk engine |
| `IRiskEngine.sol` | Interface for cross-contract ABI call to the Stylus WASM coprocessor |
| `RiskEngineSol.sol` | Pure-Solidity variance implementation (gas benchmark only) |

## Tests

39 tests, all passing. Run with:

```bash
forge test -vvv
```

Gas snapshot:

```bash
forge snapshot
```

## Deployment

Use the deploy script in `scripts/deploy.sh` from the repo root, or deploy manually:

```bash
forge create src/VetoVault.sol:VetoVault \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

Set `RPC_URL` to the Robinhood Chain / Arbitrum Sepolia RPC endpoint. After deployment, copy the `VetoVault` and `RiskEngine` addresses into `agent/.env`.

## Deployed Addresses (Arbitrum Sepolia)

| Contract | Address |
|---|---|
| RiskEngine (WASM) | `0x2c0eebee49b38b2fe363664077003339e7b45d64` |
| VetoVault | `0xba53711364C0fde5F6e8D450CFAd2655ADA70eD2` |

## Toolchain

Built with [Foundry](https://book.getfoundry.sh/). See `forge --help` for the full CLI reference.
