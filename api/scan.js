export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const token = body?.input;

    if (!token) {
      return res.status(200).json({
        error: "No token address"
      });
    }

    if (!process.env.ALCHEMY_URL) {
      return res.status(200).json({
        error: "Alchemy not configured"
      });
    }

    // ---------------------------
    // FETCH TRANSFERS
    // ---------------------------
    const txRes = await fetch(process.env.ALCHEMY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          contractAddresses: [token],
          category: ["erc20"],
          maxCount: "0x64"
        }],
        id: 1
      })
    });

    const txData = await txRes.json();
    const transfers = txData?.result?.transfers || [];

    // ---------------------------
    // BASIC METRICS
    // ---------------------------
    const txCount = transfers.length;

    const users = new Set();
    let volume = 0;

    transfers.forEach(tx => {
      if (tx.from) users.add(tx.from);
      if (tx.to) users.add(tx.to);
      if (tx.value) volume += Number(tx.value);
    });

    const uniqueUsers = users.size;

    // ---------------------------
    // SCAM LOGIC
    // ---------------------------
    let score = 0;
    let flags = [];

    if (txCount < 5) {
      score += 30;
      flags.push("Liquidity not established");
    }

    if (uniqueUsers < 5) {
      score += 30;
      flags.push("Very low holder count");
    }

    if (volume === 0) {
      score += 20;
      flags.push("No trading volume");
    }

    if (txCount > 30 && uniqueUsers < 10) {
      score += 20;
      flags.push("Suspicious trading pattern");
    }

    // ---------------------------
    // LEVEL
    // ---------------------------
    let level = "SAFE";
    if (score > 70) level = "HIGH RISK";
    else if (score > 40) level = "SUSPICIOUS";

    // ---------------------------
    // VERDICT
    // ---------------------------
    let verdict = "This token looks relatively safe.";

    if (level === "HIGH RISK") {
      verdict = "This token shows strong signs of a scam. Avoid interacting.";
    }

    if (level === "SUSPICIOUS") {
      verdict = "This token has suspicious patterns. Proceed with caution.";
    }

    // ---------------------------
    // RESPONSE ПОД UI
    // ---------------------------
    return res.status(200).json({
      token: token,
      riskScore: score,
      riskLevel: level,
      flags: flags,
      verdict: verdict,
      stats: {
        transactions: txCount,
        users: uniqueUsers,
        volume: volume
      }
    });

  } catch (err) {
    return res.status(200).json({
      error: err.message
    });
  }
}
