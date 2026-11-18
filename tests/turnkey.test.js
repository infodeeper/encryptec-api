import test from "node:test";
import assert from "node:assert/strict";
import { getTurnkeyConfig, assertTurnkeyMutationsEnabled } from "../api/_lib/turnkey/config.js";

test("Turnkey config requires organization and both API key parts", () => {
  assert.throws(
    () => getTurnkeyConfig({}),
    (error) => error.code === "TURNKEY_NOT_CONFIGURED"
      && error.missing.includes("TURNKEY_ORGANIZATION_ID")
      && error.missing.includes("TURNKEY_API_PUBLIC_KEY")
      && error.missing.includes("TURNKEY_API_PRIVATE_KEY"),
  );
});

test("Turnkey config reads organization and keeps mutations disabled by default", () => {
  const config = getTurnkeyConfig({
    TURNKEY_ORGANIZATION_ID: "org-test",
    TURNKEY_API_PUBLIC_KEY: "public-test",
    TURNKEY_API_PRIVATE_KEY: "private-test",
  });

  assert.equal(config.defaultOrganizationId, "org-test");
  assert.equal(config.apiBaseUrl, "https://api.turnkey.com");
  assert.equal(config.mutationsEnabled, false);
});

test("wallet mutations require an explicit server-side feature flag", () => {
  assert.throws(
    () => assertTurnkeyMutationsEnabled({ mutationsEnabled: false }),
    (error) => error.code === "TURNKEY_MUTATIONS_DISABLED",
  );
  assert.doesNotThrow(() => assertTurnkeyMutationsEnabled({ mutationsEnabled: true }));
});
