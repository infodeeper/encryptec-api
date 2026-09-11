import { screenCryptoWallet } from "./_lib/opensanctions.js";
import { getAlchemyUrl, getEvmAnalysis, normalizeAddress, normalizeNetwork, validateEvmAddress } from "./_lib/alchemy.js";
import { analyzeBitcoinAddress, validateBitcoinAddress } from "./_lib/bitcoin.js";
import { analyzeTronAddress, validateTronAddress } from "./_lib/tron.js";
import { analyzeSolanaAddress, validateSolanaAddress } from "./_lib/solana.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

const SUPPORTED = new Set(["ethereum", "bsc", "polygon", "arbitrum", "base", "bitcoin", "tron", "solana"]);

function error(res, status, code, message, requestId, extra = {}) {
  return res.status(status).json({ error: code, message, request_id: requestId, ...extra });
}

function nowIso() { return new Date().toISOString(); }

function levelFromScore(score, sanctionsStatus, checkedSignals) {
  if (!checkedSignals) return "unknown";
  if (sanctionsStatus === "detected" || score >= 70) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function calculateRisk({ sanctions, behavior, counterparties }) {
  let score = 0;
  const flags = [];
  if (sanctions.status === "detected") {
    score += 100;
    flags.push("Sanctions or restricted-entity match detected");
  }
  const total = Number(behavior.transaction_count || 0);
  const incoming = Number(behavior.incoming_count || 0);
  const outgoing = Number(behavior.outgoing_count || 0);
  if (total >= 500 && outgoing > incoming * 4) {
    score += 15;
    flags.push("Strong outbound transaction imbalance");
  }
  const contracts = Number(behavior.contract_counterparties || 0);
  if (contracts >= 10) {
    score += 5;
    flags.push("Frequent smart-contract counterparties");
  }
  const checkedSignals = sanctions.status !== "not_checked" || total > 0;
  score = Math.min(100, score);
  let confidence = 0.2;
  if (sanctions.status === "clear" || sanctions.status === "detected") confidence += 0.45;
  if (total > 0) confidence += 0.2;
  if (counterparties.length > 0) confidence += 0.1;
  if (behavior.first_seen && behavior.last_seen) confidence += 0.05;
  confidence = Math.min(0.99, Number(confidence.toFixed(2)));
  return { score, level: levelFromScore(score, sanctions.status, checkedSignals), confidence, flags };
}

function recommendations({ sanctions, risk, behavior }) {
  const out = [];
  if (sanctions.status === "detected") out.push("Stop automated processing and perform enhanced due diligence before accepting funds.");
  if (sanctions.status === "not_checked") out.push("Sanctions screening is unavailable; do not treat this report as a cleared AML result.");
  if (risk.level === "high") out.push("Review source of funds, counterparties and transaction history manually.");
  if (Number(behavior.transaction_count || 0) === 0) out.push("No indexed transactions were found; behavioral assessment is limited.");
  if (!out.length) out.push("No additional action is suggested by the currently checked signals.");
  return out;
}

function normalizeResult({ requestId, screenedAt, address, network, analysis, sanctions }) {
  const behavior = {
    transaction_count: Number(analysis?.behavior?.transaction_count || 0),
    incoming_count: Number(analysis?.behavior?.incoming_count || 0),
    outgoing_count: Number(analysis?.behavior?.outgoing_count || 0),
    first_seen: analysis?.behavior?.first_seen || null,
    last_seen: analysis?.behavior?.last_seen || null,
    volume_native: Number(analysis?.behavior?.volume_native || 0),
    volume_usd: analysis?.behavior?.volume_usd == null ? null : Number(analysis.behavior.volume_usd),
    native_balance: analysis?.behavior?.native_balance == null ? null : Number(analysis.behavior.native_balance),
    native_symbol: analysis?.behavior?.native_symbol || null,
    contract_counterparties: Number(analysis?.behavior?.contract_counterparties || 0)
  };
  const counterparties = Array.isArray(analysis?.counterparties) ? analysis.counterparties.slice(0, 50) : [];
  const risk = calculateRisk({ sanctions, behavior, counterparties });
  return {
    request_id: requestId,
    screened_at: screenedAt,
    address,
    network,
    engine_version: "aml-v1.1",
    risk,
    exposure: {
      sanctions: { status: sanctions.status, matches: sanctions.matches || [], reason: sanctions.reason || null },
      scam: analysis?.exposure?.scam || { status: "not_checked", reason: "No scam intelligence provider configured" },
      mixer: analysis?.exposure?.mixer || { status: "not_checked", reason: "No mixer intelligence provider configured" },
      stolen_funds: analysis?.exposure?.stolen_funds || { status: "not_checked", reason: "No stolen-funds intelligence provider configured" },
      darknet: analysis?.exposure?.darknet || { status: "not_checked", reason: "No darknet intelligence provider configured" }
    },
    behavior,
    assets: Array.isArray(analysis?.assets) ? analysis.assets : [],
    recent_operations: Array.isArray(analysis?.recent_operations) ? analysis.recent_operations.slice(0, 50) : [],
    entities: Array.isArray(analysis?.entities) ? analysis.entities : [],
    counterparties,
    recommendations: recommendations({ sanctions, risk, behavior }),
    sources: [
      ...(Array.isArray(analysis?.sources) ? analysis.sources : []),
      ...(sanctions.source ? [{ name: sanctions.source, checked_at: screenedAt }] : [])
    ]
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return error(res, 405, "METHOD_NOT_ALLOWED", "Only POST is supported.", null);

  const requestId = crypto.randomUUID();
  const screenedAt = nowIso();
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const address = normalizeAddress(body?.input || body?.address);
    const requestedNetwork = normalizeNetwork(body?.network || body?.chain);
    if (!address) return error(res, 400, "ADDRESS_REQUIRED", "Enter a wallet address.", requestId);
    if (!requestedNetwork || requestedNetwork === "auto") return error(res, 422, "NETWORK_REQUIRED", "Select the blockchain network explicitly.", requestId);
    if (!SUPPORTED.has(requestedNetwork)) return error(res, 422, "UNSUPPORTED_NETWORK", `Network ${requestedNetwork} is not supported.`, requestId, { network: requestedNetwork });

    let analysis;
    if (["ethereum", "bsc", "polygon", "arbitrum", "base"].includes(requestedNetwork)) {
      if (!validateEvmAddress(address)) return error(res, 422, "UNSUPPORTED_ADDRESS", "Enter a valid EVM wallet address.", requestId, { network: requestedNetwork });
      const url = getAlchemyUrl(requestedNetwork);
      if (!url) return error(res, 503, "NETWORK_NOT_CONFIGURED", `Alchemy provider is not configured for ${requestedNetwork}.`, requestId, { network: requestedNetwork });
      analysis = await getEvmAnalysis(url, address, requestedNetwork);
    } else if (requestedNetwork === "bitcoin") {
      if (!validateBitcoinAddress(address)) return error(res, 422, "UNSUPPORTED_ADDRESS", "Enter a valid Bitcoin address.", requestId, { network: requestedNetwork });
      analysis = await analyzeBitcoinAddress(address);
    } else if (requestedNetwork === "tron") {
      if (!validateTronAddress(address)) return error(res, 422, "UNSUPPORTED_ADDRESS", "Enter a valid Tron address.", requestId, { network: requestedNetwork });
      if (!process.env.TRONGRID_API_KEY) return error(res, 503, "NETWORK_NOT_CONFIGURED", "TronGrid provider is not configured.", requestId, { network: requestedNetwork });
      analysis = await analyzeTronAddress(address);
    } else {
      if (!validateSolanaAddress(address)) return error(res, 422, "UNSUPPORTED_ADDRESS", "Enter a valid Solana address.", requestId, { network: requestedNetwork });
      if (!process.env.HELIUS_API_KEY) return error(res, 503, "NETWORK_NOT_CONFIGURED", "Helius provider is not configured.", requestId, { network: requestedNetwork });
      analysis = await analyzeSolanaAddress(address);
    }

    const sanctions = await screenCryptoWallet(address);
    return res.status(200).json(normalizeResult({ requestId, screenedAt, address, network: requestedNetwork, analysis, sanctions }));
  } catch (e) {
    console.error("AML analysis failed", { requestId, error: e?.message });
    return error(res, 502, "ANALYSIS_FAILED", "The AML analysis could not be completed.", requestId);
  }
}
