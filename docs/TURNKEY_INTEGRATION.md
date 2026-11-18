# ENCRYPTEC — Turnkey Company Wallet integration

## Organization
- Turnkey Organization ID is configured as `TURNKEY_ORGANIZATION_ID`.
- Company Wallets is the company-controlled wallet layer.
- The backend uses the official `@turnkey/sdk-server` package. Private API credentials are server-only.

## Current implementation boundary
- `api/_lib/turnkey/config.js`: validates server-side configuration and keeps mutations disabled by default.
- `api/_lib/turnkey/client.js`: lazily initializes the official Turnkey server SDK.
- `api/_lib/turnkey/wallets.js`: controlled functions to create the company HD wallet and derive EVM deposit accounts.
- `api/_lib/supabase/client.js`: server-only Supabase REST client and atomic derivation-index RPC caller.
- No API route exposes Turnkey or billing database operations to an unauthenticated caller.
- No Turnkey activity is submitted automatically at module import, server startup, or deployment.
- No treasury transfer or signing operation is implemented.

## Deposit-address model
- One company-controlled HD wallet can derive many EVM deposit accounts.
- Each customer receives a unique EVM address derived from a database-reserved BIP32 index. The same EVM address is valid on Ethereum, BNB Smart Chain, Arbitrum One, Polygon PoS and Base; the invoice still binds payment to one exact chain and canonical token contract.
- A unique TRON deposit address is also required per customer. TRON derivation is intentionally not enabled until the exact Turnkey-supported derivation/address-format flow is verified end-to-end.
- Supabase Postgres owns the derivation counters. The `reserve_derivation_index` RPC atomically increments a family counter and returns the prior index; concurrent Vercel invocations cannot receive the same index.
- Persist Turnkey wallet ID, account address, derivation path/index, activity ID, customer reference, chain family, and timestamps in the billing database. Never persist private keys or mnemonic material.

## Supabase schema
Apply the migration in `supabase/migrations/` to the ENCRYPTEC Supabase project. It creates:
- customer and Company Wallet registry tables;
- EVM/TRON derivation counters and customer wallet accounts;
- the nine network/token combinations, initially disabled pending canonical contract verification;
- invoices, observed payments, subscriptions and audit events.
All billing tables have RLS enabled and no browser-role policies. The service key is for backend use only; never add it to Lovable/frontend environment variables.

## Required Vercel environment variables
```env
SUPABASE_URL=
SUPABASE_SECRET_KEY=
# or legacy SUPABASE_SERVICE_ROLE_KEY

TURNKEY_ORGANIZATION_ID=
TURNKEY_API_PUBLIC_KEY=
TURNKEY_API_PRIVATE_KEY=
TURNKEY_API_BASE_URL=https://api.turnkey.com
TURNKEY_ALLOW_WALLET_MUTATIONS=false
```

Keep `TURNKEY_ALLOW_WALLET_MUTATIONS=false` until the database-backed address allocator, operator authorization, and recovery process are reviewed. The Turnkey private key and Supabase server key must never be committed to GitHub or exposed to browser code.

## Operator setup sequence
1. Create the Supabase project and apply the migration.
2. Add Supabase URL and server key to Vercel Preview environment only.
3. Configure Turnkey credentials in Vercel Preview.
4. Run a read-only Supabase/Turnkey connectivity check before wallet mutations.
5. Create or select the ENCRYPTEC company HD wallet and persist its provider wallet ID in `company_wallets`.
6. Reserve a unique EVM derivation index in Supabase, derive one account, verify the returned address, then persist the account and activity result.
7. Complete a separate TRON derivation validation before enabling TRON invoice addresses.
8. Test with small non-production transfers and independent chain monitors before production activation.

## Important custody note
Turnkey is key-management and signing infrastructure, not the invoice ledger or chain indexer. Payment verification, invoice settlement, subscription entitlements, idempotency, confirmations/reorg handling, and treasury controls remain ENCRYPTEC responsibilities.
