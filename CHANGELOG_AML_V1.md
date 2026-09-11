# Encryptec AML Engine v1 — change history

## Source version
The starting point was the uploaded `encryptec-api-main.zip`.

### Previous `api/analyze.js`
- Accepted only `input`.
- Always used one `ALCHEMY_URL` endpoint.
- Indexed only the first 50 incoming and first 50 outgoing transfers.
- Returned a single human-readable `result` string.
- Risk was based on balance, activity count and simple flow ratios.
- No sanctions screening.
- No real counterparty list.
- No structured exposure states.
- Returned HTTP 200 even for validation/runtime errors.
- Claimed `PRO Analysis` despite not performing AML screening.

## AML Engine v1 changes

### `api/analyze.js`
- Structured JSON response with `request_id`, `screened_at`, `network`, `risk`, `exposure`, `behavior`, `counterparties`, `recommendations`, `sources`.
- Correct HTTP statuses for method, validation, unsupported network and provider errors.
- Requires an explicit EVM network; `auto` is rejected because an EVM address alone cannot reliably identify a chain.
- Uses selected network-specific Alchemy URL.
- Adds paginated transfer collection.
- Uses actual transaction counterparties.
- Checks top counterparties for smart-contract code.
- Removes fake AML conclusions and fake `PRO Analysis` status.
- Uses `not_checked` when an intelligence provider is not configured.
- Adds a conservative risk/confidence model.
- Does not penalize a wallet merely because it has low balance or no activity.
- Does not expose provider/API secrets to the frontend.

### `api/_lib/alchemy.js`
- Centralized Alchemy RPC calls.
- Timeout handling.
- Network aliases.
- Paginated `alchemy_getAssetTransfers`.
- EVM address validation.
- `eth_getCode` support for counterparty classification.

### `api/_lib/opensanctions.js`
- Adds OpenSanctions `CryptoWallet` screening.
- Uses `/match/default`.
- Uses a configurable 0.85 default threshold.
- Screens sanction, linked-sanction, debarment and PEP topics.
- Returns `clear`, `detected` or `not_checked`.

### Token Scan preservation
The uploaded archive referenced `api/_lib/*` from `scan.js` but did not contain those files. They have been restored with ESM-compatible `.js` imports so Token Scan is not broken by the AML work.

### Important scope limitation
AML Engine v1 does NOT claim to detect scam, mixer, stolen funds or darknet exposure unless a dedicated provider is configured. Those fields deliberately return `not_checked`.

## Required Vercel configuration
At minimum:
- `ALCHEMY_URL`
- `OPENSANCTIONS_API_KEY`

For additional supported EVM networks configure their corresponding `ALCHEMY_*_URL` variables.

Keep all provider keys in Vercel Environment Variables. Never put them into Lovable/frontend code.
