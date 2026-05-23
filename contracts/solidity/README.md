# Veto — Solidity Contracts

EVM layer of the Veto execution sandbox. Handles fund custody, access control, and cross-contract calls to the Stylus WASM risk engine.

## Contracts

| Contract | Purpose |
|---|---|
| `VetoVault.sol` | Main vault — holds funds, intercepts agent trades, calls risk engine |
| `IRiskEngine.sol` | Interface for cross-contract ABI call to the Stylus WASM coprocessor |
| `RiskEngineSol.sol` | Pure-Solidity variance implementation (gas benchmark only) |

## Tests

23 tests, all passing. Run with:

```bash
forge test -vvv
```

Gas snapshot:

```bash
forge snapshot
```

## Deployment

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Set `RPC_URL` to the Robinhood Chain / Arbitrum Sepolia RPC endpoint. After deployment, copy the `VetoVault` and `RiskEngine` addresses into `agent/.env`.

## Deployed Addresses (Arbitrum Sepolia)

| Contract | Address |
|---|---|
| RiskEngine (WASM) | `0x0a94398c550226ca01570afede89e378d81e9426` |
| VetoVault | `0x77435CF556A3705496Aa3739bD3678D9edfcB69c` |

## Toolchain

Built with [Foundry](https://book.getfoundry.sh/). See `forge --help` for the full CLI reference.
