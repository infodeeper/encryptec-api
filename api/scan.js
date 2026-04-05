import { getDexData } from "./_lib/dex";
import { getHolders } from "./_lib/etherscan";
import { getHoneypot } from "./_lib/honeypot";
import { calculateRisk } from "./_lib/utils";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const token = body?.input;

    if (!token) {
      return res.status(200).json({ error: "No token" });
    }

    // 🚀 ПАРАЛЛЕЛЬНО
    const [dex, holders, honeypot] = await Promise.all([
      getDexData(token),
      getHolders(token),
      getHoneypot(token)
    ]);

    const risk = calculateRisk({
      liquidity: dex.liquidity,
      volume24h: dex.volume24h,
      holders,
      honeypot
    });

    let verdict = "Token looks safe";

    if (risk.level === "HIGH RISK") {
      verdict = "High scam probability";
    }

    if (risk.level === "SUSPICIOUS") {
      verdict = "Suspicious token";
    }

    return res.status(200).json({
      riskScore: risk.score,
      riskLevel: risk.level,
      verdict,
      flags: risk.flags,
      stats: {
        liquidity: dex.liquidity,
        volume24h: dex.volume24h,
        holders,
        price: dex.price,
        honeypot
      }
    });

  } catch (err) {
    return res.status(200).json({
      error: err.message
    });
  }
}
