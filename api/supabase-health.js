import { supabaseRequest } from "./_lib/supabase/client.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  // This diagnostic route is intentionally available only on Vercel Preview.
  // It must never expose database diagnostics from the production deployment.
  if (process.env.VERCEL_ENV !== "preview") {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  try {
    // Read one harmless identifier only. This verifies credentials, REST access,
    // table existence and grants without changing any database records.
    await supabaseRequest("supported_assets?select=id&limit=1");

    return res.status(200).json({
      ok: true,
      service: "encryptec-api",
      checks: {
        supabase: "connected",
        supported_assets: "readable"
      },
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    // Never return provider messages, request headers, URLs or credentials.
    console.error("Supabase preview health check failed", {
      code: error?.code || "SUPABASE_CHECK_FAILED",
      status: error?.status || null,
      message: error?.message || null,
      details: error?.details || null,
      hint: error?.hint || null,
      requestPath: error?.requestPath || null
    });

    return res.status(503).json({
      ok: false,
      service: "encryptec-api",
      checks: {
        supabase: "failed"
      },
      error: "SUPABASE_CONNECTION_FAILED"
    });
  }
}
