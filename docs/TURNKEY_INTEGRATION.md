# ENCRYPTEC — Turnkey Company Wallet integration

## Organization
- Turnkey Organization ID is configured as `TURNKEY_ORGANIZATION_ID`.
- Company Wallets is the company-controlled wallet layer.
- The backend uses the official `@turnkey/sdk-server` package. Private API credentials are server-only.

## Current implementation boundary
- `api/_lib/turnkey/config.js`: validates server-side configuration and keeps mutations disabled by default.
- `api/_lib/turnkey/client.js`: lazily initializes the official Turnkey server SDK.
- `api/_lib/turnkey/wallets.js`: controlled functions to create the company HD wallet and derive EVM deposit accounts.
- No API route exposes Turnkey operations to an unauthenticated caller.
- No Turnkey activity is submitted automatically at module import, server startup, or deployment.
- No treasury transfer or signing operation is implemented.

## Deposit-address model
- One company-controlled HD wallet can derive many EVM deposit accounts.
- Each customer receives a unique EVM address derived from a database-reserved BIP32 index. The same EVM address is valid on Ethereum, BNB Smart Chain, Arbitrum One, Polygon PoS and Base; the invoice still binds payment to one exact chain and canonical token contract.
- A unique TRON deposit address is also required per customer. TRON derivation is intentionally not enabled in this phase until the exact Turnkey-supported derivation/address-format flow is verified end-to-end. Do not display or accept TRON deposits using an EVM address.
- Never allocate derivation indexes using serverless in-memory counters. The database must reserve each index transactionally and enforce a unique constraint before calling Turnkey.
- Persist Turnkey wallet ID, account address, derivation path/index, activity ID, customer reference, chain family, and timestamps in the billing database. Never persist private keys or mnemonic material.

## Required Vercel environment variables
```env
TURNKEY_ORGANIZATION_ID=
TURNKEY_API_PUBLIC_KEY=
TURNKEY_API_PRIVATE_KEY=
TURNKEY_API_BASE_URL=https://api.turnkey.com
TURNKEY_ALLOW_WALLET_MUTATIONS=false
```

Keep `TURNKEY_ALLOW_WALLET_MUTATIONS=false` until the database-backed address allocator, operator authorization, and recovery process are implemented and reviewed. The private key must never be committed to GitHub or exposed to browser code.

## Operator setup sequence
1. Create a Company Wallet in the Turnkey Dashboard or use an approved controlled setup flow.
2. Record its wallet ID in the ENCRYPTEC persistent database/configuration after verifying the organization.
3. Configure the three required Turnkey secrets in Vercel Preview first.
4. Run a read-only connection check before enabling wallet mutations.
5. Reserve a unique EVM derivation index in the database, derive one account, verify the returned address, then persist the activity result.
6. Complete a separate TRON derivation validation before enabling TRON invoice addresses.
7. Test with small non-production transfers and independent chain monitors before production activation.

## Important custody note
Turnkey is key-management and signing infrastructure, not the invoice ledger or chain indexer. Payment verification, invoice settlement, subscription entitlements, idempotency, confirmations/reorg handling, and treasury controls remain ENCRYPTEC responsibilities.
