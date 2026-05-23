# Security Policy

## Testnet Notice

Veto is currently deployed on **Arbitrum Sepolia testnet only**. There are no real funds at risk. If and when Veto moves to mainnet, this policy will be updated accordingly.

## Scope

The following components are in scope for security reports:

| Component | Location |
|---|---|
| `VetoVault.sol` — fund custody, access control, trade interception | `contracts/solidity/src/VetoVault.sol` |
| `RiskEngine` (Stylus/WASM) — variance computation, threshold enforcement | `contracts/stylus/src/lib.rs` |
| `IRiskEngine.sol` — cross-contract ABI interface | `contracts/solidity/src/IRiskEngine.sol` |

The dashboard (`dashboard/`) and Python agent (`agent/`) are out of scope for security reports — they are off-chain components and hold no funds.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately via one of:

- **GitHub private advisory**: [github.com/edycutjong/veto/security/advisories/new](https://github.com/edycutjong/veto/security/advisories/new)
- **Email**: edy.cu@live.com

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Affected contract and function(s)
- Potential impact

## What to Expect

| Timeline | Action |
|---|---|
| Within 48 hours | Acknowledgement of your report |
| Within 7 days | Initial assessment and severity triage |
| Within 30 days | Fix or mitigation, coordinated disclosure |

We follow responsible disclosure — we ask that you give us reasonable time to address the issue before making it public.

## Known Limitations

- The Stylus risk engine trusts price calldata provided by the agent. A malicious agent could supply manipulated prices — this is a known design trade-off documented in `contracts/stylus/src/lib.rs`.
- `RiskEngineSol.sol` is a benchmarking contract only and is not used in production.

## Out of Scope

- Issues on Arbitrum Sepolia testnet with no mainnet equivalent
- Bugs in `RiskEngineSol.sol` (benchmark only, not deployed in production)
- Dashboard UI bugs
- Agent trading logic
- Third-party dependencies (Arbitrum Stylus SDK, OpenZeppelin, Foundry)
