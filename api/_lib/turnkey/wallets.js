import { getTurnkeyConfig, assertTurnkeyMutationsEnabled } from "./config.js";
import { getTurnkeyClient } from "./client.js";

const MAX_DERIVATION_INDEX = 2_147_483_647;

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function requireDerivationIndex(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_DERIVATION_INDEX) {
    throw new TypeError("derivationIndex must be a non-negative safe integer within the BIP32 index range");
  }
  return value;
}

/**
 * Creates the ENCRYPTEC company HD wallet.
 * Call only from a controlled operator workflow; this does not run at startup.
 * Keep the returned walletId in the persistent database/configuration.
 */
export async function createCompanyWallet({ walletName = "ENCRYPTEC deposits" } = {}) {
  const config = getTurnkeyConfig();
  assertTurnkeyMutationsEnabled(config);

  const client = await getTurnkeyClient();
  return client.apiClient().createWallet({
    walletName: requireNonEmptyString(walletName, "walletName"),
    accounts: [],
    mnemonicLength: 24,
  });
}

/**
 * Derives one EVM-compatible deposit account from the company HD wallet.
 * The caller MUST reserve derivationIndex transactionally in the persistent DB
 * before calling this function, then persist the returned address and activity ID.
 *
 * An EVM address can receive supported ERC-20 assets on Ethereum, BNB Chain,
 * Arbitrum, Polygon and Base; chain/token verification remains the billing monitor's job.
 */
export async function createEvmDepositAccount({
  walletId,
  customerReference,
  derivationIndex,
}) {
  const config = getTurnkeyConfig();
  assertTurnkeyMutationsEnabled(config);

  const safeWalletId = requireNonEmptyString(walletId, "walletId");
  const safeCustomerReference = requireNonEmptyString(customerReference, "customerReference");
  const index = requireDerivationIndex(derivationIndex);
  const client = await getTurnkeyClient();

  return client.apiClient().createWalletAccounts({
    walletId: safeWalletId,
    accounts: [{
      curve: "CURVE_SECP256K1",
      pathFormat: "PATH_FORMAT_BIP32",
      path: `m/44'/60'/0'/0/${index}`,
      addressFormat: "ADDRESS_FORMAT_UNCOMPRESSED",
      name: `encryptec-evm-deposit-${safeCustomerReference}-${index}`,
    }],
    persist: true,
  });
}
