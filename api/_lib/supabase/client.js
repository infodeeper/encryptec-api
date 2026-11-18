const DEFAULT_TIMEOUT_MS = 10_000;

export function getSupabaseConfig(env = process.env) {
  const url = String(env.SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const key = String(env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  const missing = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!key) missing.push("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");

  if (missing.length) {
    const error = new Error(`Supabase is not configured. Missing: ${missing.join(", ")}`);
    error.code = "SUPABASE_NOT_CONFIGURED";
    error.missing = missing;
    throw error;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new TypeError("SUPABASE_URL must be a valid absolute URL.");
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new TypeError("SUPABASE_URL must use HTTPS outside localhost.");
  }

  return { url, key };
}

export async function supabaseRequest(path, {
  method = "GET",
  body,
  prefer,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A Fetch-compatible implementation is required.");
  const { url, key } = getSupabaseConfig(env);
  const normalizedPath = String(path ?? "").replace(/^\/+/, "");
  if (!normalizedPath || normalizedPath.includes("..")) throw new TypeError("A valid Supabase REST path is required.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${url}/rest/v1/${normalizedPath}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }
    if (!response.ok) {
      const error = new Error(payload?.message || `Supabase request failed with status ${response.status}`);
      error.code = payload?.code || "SUPABASE_REQUEST_FAILED";
      error.status = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function reserveDerivationIndex(family, options = {}) {
  if (family !== "evm" && family !== "tron") {
    throw new TypeError("family must be either 'evm' or 'tron'.");
  }
  const result = await supabaseRequest("rpc/reserve_derivation_index", {
    ...options,
    method: "POST",
    body: { p_family: family },
  });
  const value = Array.isArray(result) ? result[0] : result;
  const index = Number(value);
  if (!Number.isSafeInteger(index) || index < 0 || index > 2_147_483_647) {
    throw new Error("Supabase returned an invalid derivation index.");
  }
  return index;
}
