import { getTurnkeyConfig } from "./config.js";

let cachedClient;

export async function getTurnkeyClient() {
  if (cachedClient) return cachedClient;

  const config = getTurnkeyConfig();
  const { Turnkey } = await import("@turnkey/sdk-server");

  cachedClient = new Turnkey({
    apiBaseUrl: config.apiBaseUrl,
    apiPublicKey: config.apiPublicKey,
    apiPrivateKey: config.apiPrivateKey,
    defaultOrganizationId: config.defaultOrganizationId,
  });

  return cachedClient;
}

export function resetTurnkeyClientForTests() {
  cachedClient = undefined;
}
