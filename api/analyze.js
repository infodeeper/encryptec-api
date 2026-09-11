import { screenCryptoWallet } from "./_lib/opensanctions.js";
import {
  getAlchemyUrl,
  getCode,
  getNativeBalance,
  getTransfers,
  normalizeAddress,
  normalizeNetwork,
  validateEvmAddress
} from "./_lib/alchemy.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function transferTimestamp(tx) {
  return tx?.metadata?.blockTimestamp || tx?.metadata?.block_timestamp || null;
}

function summarizeTransfers(incoming, outgoing) {
  const all = [...incoming, ...outgoing];
  const timestamps = all.map(transferTimestamp).filter(Boolean).map((v) => new Date(v).getTime()).filter(Number.isFinite);
  const firstSeen = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
  const lastSeen = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;

  const volume = all.reduce((sum, tx) => {
    const value = Number(tx?.value);
    return Number.isFinite(value) ? sum + Math.max(value, 0) : sum;
  }, 0);

  return { firstSeen, lastSeen, volumeNativeUnits: volume };
}

async function buildCounterparties(url, address, incoming, outgoing) {
  const map = new Map();

  for (const tx of incoming) {
    const peer = String(tx?.from || "").trim();
    if (!peer || peer.toLowerCase() === address.toLowerCase()) continue;
    const item = map.get(peer) || { address: peer, incoming: 0, outgoing: 0, transfers: 0, assets: [] };
    item.incoming += 1;
    item.transfers += 1;
    if (tx?.asset) item.assets.push(tx.asset);
    map.set(peer, item);
  }

  for (const tx of outgoing) {
    const peer = String(tx?.to || "").trim();
    if (!peer || peer.toLowerCase() === address.toLowerCase()) continue;
    const item = map.get(peer) || { address: peer, incoming: 0, outgoing: 0, transfers: 0, assets: [] };
    item.outgoing += 1;
    item.transfers += 1;
    if (tx?.asset) item.assets.push(tx.asset);
    map.set(peer, item);
  }

  const ranked = [...map.values()]
    .sort((a, b) => b.transfers - a.transfers)
    .slice(0, 25);

  const checked = await Promise.all(
    ranked.map(async (item) => ({
      ...item,
      assets: unique(item.assets).slice(0, 10),
      entity_type: await getCode(url, item.address)
        .then((isContract) => isContract === true ? "contract" : isContract === false ? "wallet" : "unknown")
    }))
  );

  return checked;
}

function calculateRisk({ sanctions, incoming, outgoing, counterparties }) {
  let score = 0;
  const flags = [];

  if (sanctions.status === "detected") {
    score += 100;
    flags.push("Sanctions or restricted-entity match detected");
  }

  const total = incoming.length + outgoing.length;
  if (total > 500 && outgoing.length > incoming.length * 4) {
    score += 15;
    flags.push("Strong outbound transaction imbalance");
  }

  const contractCount = counterparties.filter((x) => x.entity_type === "contract").length;
  if (contractCount >= 10) {
    score += 5;
    flags.push("Frequent smart-contract counterparties");
  }

  score = Math.min(score, 100);

  let level = "low";
  if (sanctions.status === "not_checked") level = "unknown";
  if (score >= 70) level = "high";
  else if (score >= 30) level = "medium";

  let confidence = 0.35;
  if (sanctions.status === "clear") confidence += 0.35;
  if (total > 0) confidence += 0.2;
  if (counterparties.length > 0) confidence += 0.1;
  confidence = Math.min(0.99, Number(confidence.toFixed(2)));

  return { score, level, confidence, flags };
}

function recommendations({ sanctions, risk, behavior }) {
  const result = [];
  if (sanctions.status === "detected") {
    result.push("Stop automated processing and perform enhanced due diligence before accepting funds.");
  }
  if (sanctions.status === "not_checked") {
    result.push("Sanctions screening is unavailable; do not treat this report as a cleared AML result.");
  }
  if (risk.level === "high") {
    result.push("Review source of funds, counterparties and transaction history manually.");
  }
  if (behavior.transaction_count === 0) {
    result.push("No indexed transactions were found; the wallet cannot be behaviorally assessed from this source.");
  }
  if (!result.length) result.push("No additional action is suggested by the currently checked signals.");
  return result;
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  const requestId = crypto.randomUUID();
  const screenedAt = new Date().toISOString();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const address = normalizeAddress(body?.input || body?.address);
    const requestedNetwork = normalizeNetwork(body?.network || body?.chain);

    if (!address) {
      return res.status(400).json({ error: "ADDRESS_REQUIRED", request_id: requestId });
    }

    if (requestedNetwork === "auto") {
      return res.status(422).json({
        error: "NETWORK_REQUIRED",
        message: "An EVM wallet address cannot reliably identify its blockchain. Select the network explicitly.",
        request_id: requestId
      });
    }

    if (!validateEvmAddress(address)) {
      return res.status(422).json({
        error: "UNSUPPORTED_ADDRESS",
        message: "AML Engine v1 currently supports EVM wallet addresses on the configured Alchemy networks.",
        request_id: requestId
      });
    }

    const network = requestedNetwork || "ethereum";
    const alchemyUrl = getAlchemyUrl(network);

    if (!alchemyUrl) {
      return res.status(503).json({
        error: "NETWORK_NOT_CONFIGURED",
        message: `Alchemy provider is not configured for ${network}.`,
        request_id: requestId,
        network
      });
    }

    const [balanceEth, outgoing, incoming, sanctions] = await Promise.all([
      getNativeBalance(alchemyUrl, address),
      getTransfers(alchemyUrl, address, "outgoing"),
      getTransfers(alchemyUrl, address, "incoming"),
      screenCryptoWallet(address)
    ]);

    const behaviorSummary = summarizeTransfers(incoming, outgoing);
    const counterparties = await buildCounterparties(alchemyUrl, address, incoming, outgoing);
    const contractInteractions = counterparties.filter((x) => x.entity_type === "contract").length;

    const behavior = {
      transaction_count: incoming.length + outgoing.length,
      incoming_count: incoming.length,
      outgoing_count: outgoing.length,
      first_seen: iso(behaviorSummary.firstSeen),
      last_seen: iso(behaviorSummary.lastSeen),
      native_balance: Number(balanceEth.toFixed(8)),
      indexed_transfer_volume_native: Number(behaviorSummary.volumeNativeUnits.toFixed(8)),
      contract_counterparties: contractInteractions
    };

    const risk = calculateRisk({ sanctions, incoming, outgoing, counterparties });
    const actionRecommendations = recommendations({ sanctions, risk, behavior });

    return res.status(200).json({
      request_id: requestId,
      screened_at: screenedAt,
      address,
      network,
      engine_version: "aml-v1",
      risk,
      exposure: {
        sanctions: {
          status: sanctions.status,
          matches: sanctions.matches || [],
          reason: sanctions.reason || null
        },
        scam: { status: "not_checked", reason: "No scam intelligence provider configured in AML Engine v1" },
        mixer: { status: "not_checked", reason: "No mixer intelligence provider configured in AML Engine v1" },
        stolen_funds: { status: "not_checked", reason: "No stolen-funds intelligence provider configured in AML Engine v1" },
        darknet: { status: "not_checked", reason: "No darknet intelligence provider configured in AML Engine v1" }
      },
      behavior,
      entities: [],
      counterparties,
      recommendations: actionRecommendations,
      sources: [
        { name: "Alchemy", checked_at: screenedAt },
        ...(sanctions.source ? [{ name: sanctions.source, checked_at: screenedAt }] : [])
      ]
    });
  } catch (error) {
    console.error("AML analysis failed", { requestId, error: error?.message });
    return res.status(502).json({
      error: "ANALYSIS_FAILED",
      message: "The AML analysis could not be completed.",
      request_id: requestId
    });
  }
}
