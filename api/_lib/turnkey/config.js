const REQUIRED_ENV = [
  "TURNKEY_ORGANIZATION_ID",
  "TURNKEY_API_PUBLIC_KEY",
  "TURNKEY_API_PRIVATE_KEY",
];

export function getTurnkeyConfig(env = process.env) {
  const missing = REQUIRED_ENV.filter((key) => !String(env[key] ?? "").trim());
  if (missing.length) {
    const error = new Error(`Turnkey is not configured. Missing: ${missing.join(", ")}`);
    error.code = "TURNKEY_NOT_CONFIGURED";
    error.missing = missing;
    throw error;
  }

  return {
    apiBaseUrl: env.TURNKEY_API_BASE_URL || "https://api.turnkey.com",
    apiPublicKey: env.TURNKEY_API_PUBLIC_KEY.trim(),
    apiPrivateKey: env.TURNKEY_API_PRIVATE_KEY.trim(),
    defaultOrganizationId: env.TURNKEY_ORGANIZATION_ID.trim(),
    mutationsEnabled: env.TURNKEY_ALLOW_WALLET_MUTATIONS === "true",
  };
}

export function assertTurnkeyMutationsEnabled(config) {
  if (!config?.mutationsEnabled) {
    const error = new Error("Turnkey wallet mutations are disabled. Set TURNKEY_ALLOW_WALLET_MUTATIONS=true only after review.");
    error.code = "TURNKEY_MUTATIONS_DISABLED";
    throw error;
  }
}
