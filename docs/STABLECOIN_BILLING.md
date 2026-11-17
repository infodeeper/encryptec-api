# ENCRYPTEC Stablecoin Billing — implementation plan

## Confirmed product rules
- Billing model: one separate invoice per monthly billing period; no wallet allowance and no automatic pull.
- Plans: Free ($0), Professional ($49/month), Business ($199/month).
- Each invoice is bound to one customer, one plan, one billing period, one chain and one canonical token contract.
- A transaction hash submitted by a client is not proof of payment. Status must come from independently verified on-chain data.
- Duplicate webhook deliveries and repeated chain scans must be idempotent.
- Wrong-token, wrong-chain, underpaid, overpaid, late and reorged transfers must not silently activate or extend access.
- Treasury sweeps are separate from invoice settlement and require server-side policy checks.

## Selected network scope
- TRON — USDT (TRC-20)
- Arbitrum One — USDT and USDC
- Polygon PoS — USDT and USDC
- Base — USDC
- Ethereum Mainnet — USDT and USDC
- EVM USDT — exact chain must be confirmed before enabling; do not treat this as a chain identifier.

The API currently has a BNB Smart Chain (bsc) configuration for AML data retrieval. That does not mean BSC USDT billing is approved. Confirm whether EVM USDT means BNB Smart Chain or another EVM chain.

## Target architecture
1. **Billing API** — create invoices from authenticated customer identity and server-side plan price. Never trust client-supplied customer ID, amount, plan price, token contract or destination wallet.
2. **Wallet/address provider** — Turnkey is a wallet/key-management layer, not an invoice ledger or chain indexer. Provision isolated deposit addresses only after custody and recovery are approved. Keep signing credentials server-side.
3. **Chain monitors** — independent TRON and EVM adapters verify destination, canonical token contract, amount, transaction success, block inclusion and finality. Use transaction hash plus log/transfer index as unique payment identity and recheck recent confirmations for reorgs.
4. **Invoice and entitlement ledger** — persist invoices, observed transfers, reconciliation outcomes, audit events and subscription periods. Enforce idempotency and uniqueness in the database. Extend access only after verified payment. Route partial, excess, late and duplicate payments to explicit states.
5. **Treasury** — deposit addresses are not treasury. Sweeps are separate jobs with gas/energy policy, destination allowlist, daily limits and auditable approval. Never store seed phrases or private keys in application environment variables.

## Current code in this branch
- api/_lib/billing/invoice-domain.js: exact decimal arithmetic using BigInt, payment classification, status transition guards and deterministic billing-period reference.
- tests/billing-invoice.test.js: unit tests for amount precision, payment classification and lifecycle transitions.

This is a safe domain foundation only. No public billing endpoint, database persistence, wallet generation, blockchain monitor, live provider credentials, subscription activation or production deployment has been added.

## Blocking decisions before live integration
1. Confirm what EVM USDT means (for example, BNB Smart Chain USDT).
2. Select the persistent database already used by the product, or approve a new managed database. Serverless memory is not a valid invoice/payment ledger.
3. Approve the wallet custody model and Turnkey organization/API setup. Provider account and server-side credentials are required before real addresses can be generated.
4. Define finality thresholds per network and operational refund/overpayment policy.

## Security baseline
- Authenticated customer ownership checks on every invoice read.
- Rate limiting and idempotency keys on invoice creation.
- Server-side price lookup; immutable invoice terms after creation.
- Canonical token-contract allowlist per chain.
- Verify provider webhook signatures; otherwise independently verify through RPC/indexer.
- Never activate from frontend callbacks or unverified webhook payloads.
- Append-only audit trail for reconciliation and manual overrides.
- No production deployment or treasury transaction without explicit operator approval.