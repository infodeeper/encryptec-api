# ENCRYPTEC Stablecoin Billing — implementation plan

## Confirmed product rules
- Billing model: one separate invoice per monthly billing period; no wallet allowance and no automatic pull.
- Plans: Free ($0), Professional ($49/month), Business ($199/month).
- Each invoice is bound to one customer, one plan, one billing period, one chain and one canonical token contract.
- A transaction hash submitted by a client is not proof of payment. Status must come from independently verified on-chain data.
- Duplicate webhook deliveries and repeated chain scans must be idempotent.
- Wrong-token, wrong-chain, underpaid, overpaid, late and reorged transfers must not silently activate or extend access.
- Treasury sweeps are separate from invoice settlement and require server-side policy checks.

## Confirmed payment network scope
- TRON — USDT (TRC-20)
- BNB Smart Chain — USDT (BEP-20)
- Arbitrum One — USDT and USDC
- Polygon PoS — USDT and USDC
- Base — USDC
- Ethereum Mainnet — USDT and USDC

This is six networks and nine network/token combinations. Each token must be configured by its canonical contract address and decimals for the specific chain. Never accept a token by symbol alone.

## Database foundation
- Supabase Postgres is the source of truth for customers, wallet accounts, invoices, observed payments, subscriptions and audit events.
- Migration `supabase/migrations/202611190001_billing_wallet_foundation.sql` creates the initial schema.
- The nine network/token rows are inserted disabled. Canonical contract addresses must be independently verified and populated before enabling an asset.
- `reserve_derivation_index(family)` is a server-role-only PostgreSQL RPC that atomically allocates EVM/TRON derivation indexes. Do not use an in-memory counter.
- RLS is enabled for every billing table. Browser roles have no table grants or policies; only the trusted backend service role receives access.

## Target architecture
1. **Billing API** — create invoices from authenticated customer identity and server-side plan price. Never trust client-supplied customer ID, amount, plan price, token contract or destination wallet.
2. **Wallet/address provider** — Turnkey Company Wallets manages company-controlled keys and signing. ENCRYPTEC owns invoice-to-address allocation and persistence. One EVM deposit account can receive ERC-20 assets on Ethereum, BNB Chain, Arbitrum, Polygon and Base; the invoice is still chain-specific. A distinct TRON address is required for TRC-20 deposits.
3. **Chain monitors** — independent TRON and EVM adapters verify destination, canonical token contract, amount, transaction success, block inclusion and finality. Use transaction hash plus log/transfer index as unique payment identity and recheck recent confirmations for reorgs.
4. **Invoice and entitlement ledger** — persist invoices, observed transfers, reconciliation outcomes, audit events and subscription periods. Enforce idempotency and uniqueness in the database. Extend access only after verified payment. Route partial, excess, late and duplicate payments to explicit states.
5. **Treasury** — deposit addresses are not treasury. Sweeps are separate jobs with gas/energy policy, destination allowlist, daily limits and auditable approval. Never store seed phrases or private keys in application environment variables.

## Turnkey integration status
- Turnkey Organization ID has been supplied by the operator.
- Operator reports that an API keypair has been created and Company Wallets is visible in the dashboard.
- Server-side SDK client/configuration and guarded wallet functions are implemented on the Turnkey feature branch.
- Wallet mutations are disabled by default. No live Turnkey request or wallet has been created by this code change.
- EVM deposit-account derivation is scaffolded using a database-reserved BIP32 index.
- TRON derivation remains disabled pending an end-to-end verification of Turnkey's supported address/public-key format.
- No authenticated public endpoint exposes Turnkey operations.

## Remaining implementation gates
1. Apply the Supabase migration and configure the server-side key in Vercel Preview.
2. Run read-only Supabase and Turnkey connectivity checks.
3. Create or select the ENCRYPTEC company HD wallet and persist its wallet ID.
4. Implement the authenticated customer/address provisioning workflow.
5. Validate TRON derivation separately before enabling TRON deposit invoices.
6. Verify canonical contract addresses and set supported assets enabled only after validation.
7. Define finality thresholds per network and operational refund/overpayment policy.
8. Implement authenticated invoice API, chain monitors and subscription entitlement updates.
9. Complete testnet/small-value verification before production.

## Security baseline
- Authenticated customer ownership checks on every invoice read.
- Rate limiting and idempotency keys on invoice creation.
- Server-side price lookup; immutable invoice terms after creation.
- Canonical token-contract allowlist per chain.
- Verify provider webhook signatures; otherwise independently verify through RPC/indexer.
- Never activate from frontend callbacks or unverified webhook payloads.
- Append-only audit trail for reconciliation and manual overrides.
- Wallet mutations remain disabled until database allocation and operator authorization are implemented.
- No production deployment or treasury transaction without explicit operator approval.
