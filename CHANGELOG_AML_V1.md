# Encryptec AML Engine v1.1

## What changed
- Added one normalized `/api/analyze` response for Ethereum, BNB Chain, Polygon, Arbitrum, Base, Bitcoin, Tron and Solana.
- EVM uses separate Alchemy endpoints per network.
- Bitcoin uses Blockstream public API.
- Tron uses TronGrid and requires `TRONGRID_API_KEY`.
- Solana uses Helius and requires `HELIUS_API_KEY`.
- OpenSanctions wallet screening is applied to every supported network and requires `OPENSANCTIONS_API_KEY` for a real check.
- Added real recent operations, assets and transaction counterparties where the provider exposes them.
- Removed the previous EVM-only hard stop for Bitcoin/Tron/Solana.
- Native volume is explicitly labeled as native units; no fake USD conversion is performed.
- Unknown/unavailable AML signals remain `not_checked` rather than being treated as safe.

## Environment variables
See `.env.example`.

## Important scope
The engine does not claim scam/mixer/stolen-funds/darknet clearance without a provider that actually checks those categories. Those fields remain `not_checked` until such providers are integrated.
