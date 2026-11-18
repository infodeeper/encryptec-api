import test from "node:test";
import assert from "node:assert/strict";
import { getSupabaseConfig, reserveDerivationIndex } from "../api/_lib/supabase/client.js";

test("Supabase config requires URL and a server key", () => {
  assert.throws(
    () => getSupabaseConfig({}),
    (error) => error.code === "SUPABASE_NOT_CONFIGURED"
      && error.missing.includes("SUPABASE_URL")
      && error.missing.some((item) => item.includes("SUPABASE_SECRET_KEY")),
  );
});

test("Supabase config accepts server-only secret key and requires HTTPS", () => {
  const config = getSupabaseConfig({
    SUPABASE_URL: "https://example.supabase.co/",
    SUPABASE_SECRET_KEY: "sb_secret_test_key",
  });
  assert.equal(config.url, "https://example.supabase.co");
  assert.equal(config.key, "sb_secret_test_key");
  assert.throws(() => getSupabaseConfig({
    SUPABASE_URL: "http://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-secret",
  }), /HTTPS/);
});

test("derivation allocator validates family before making a request", async () => {
  await assert.rejects(
    () => reserveDerivationIndex("bitcoin", {
      env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "secret" },
    }),
    /family must be either/,
  );
});

test("derivation allocator calls the transactional RPC and returns an integer", async () => {
  let request;
  const index = await reserveDerivationIndex("evm", {
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "secret" },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return { ok: true, status: 200, text: async () => "17" };
    },
  });

  assert.equal(index, 17);
  assert.equal(request.url, "https://example.supabase.co/rest/v1/rpc/reserve_derivation_index");
  assert.equal(request.init.method, "POST");
  assert.deepEqual(JSON.parse(request.init.body), { p_family: "evm" });
  assert.equal(request.init.headers.apikey, "secret");
});

test("new Supabase secret keys are not sent as Bearer JWTs", async () => {
  let headers;
  await reserveDerivationIndex("tron", {
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
    fetchImpl: async (_url, init) => {
      headers = init.headers;
      return { ok: true, status: 200, text: async () => "3" };
    },
  });
  assert.equal(headers.apikey, "sb_secret_test");
  assert.equal(headers.Authorization, undefined);
});

test("legacy service_role JWT remains supported as a Bearer token", async () => {
  let headers;
  await reserveDerivationIndex("evm", {
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "legacy-jwt" },
    fetchImpl: async (_url, init) => {
      headers = init.headers;
      return { ok: true, status: 200, text: async () => "4" };
    },
  });
  assert.equal(headers.apikey, "legacy-jwt");
  assert.equal(headers.Authorization, "Bearer legacy-jwt");
});
