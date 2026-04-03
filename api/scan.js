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
      return res.status(200).json({ error: "No token address" });
    }

    if (!process.env.ALCHEMY_URL) {
      return res.status(200).json({ error: "Alchemy not configured" });
    }

    // ---------------------------
    // 1. TRANSFERS
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

    const txCount = transfers.length;

    // ---------------------------
    // 2. USERS + VOLUME
    // ---------------------------
    const users = new Set();
    let volume = 0;

    transfers.forEach(tx => {
      if (tx.from) users.add(tx.from);
      if (tx.to) users.add(tx.to);
      if (tx.value) volume += Number(tx.value);
    });

    const uniqueUsers = users.size;

    // ---------------------------
    // 3. TOKEN NAME (эвристика)
    // ---------------------------
    const tokenName = transfers[0]?.asset || "Unknown Token";

    // ---------------------------
    // 4. TOP HOLDERS (эвристика)
    // ---------------------------
    const holderMap = {};

    transfers.forEach(tx => {
      if (tx.to) {
        holderMap[tx.to] = (holderMap[tx.to] || 0) + (Number(tx.value) || 0);
      }
    });

    const sortedHolders = Object.entries(holderMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const topHolderShare =
      sortedHolders.length > 0
        ? sortedHolders[0][1] / volume
        : 0;

    // ---------------------------
    // 5. LIQUIDITY (DEX proxy)
    // ---------------------------
    let liquidityFlag = false;

    if (txCount > 50 && uniqueUsers < 30) {
      liquidityFlag = true;
    }

    // ---------------------------
    // 6. HONEYPOT DETECTION
    // ---------------------------
    let honeypot = false;

    const sellTx = transfers.filter(tx => tx.from).length;
    const buyTx = transfers.filter(tx => tx.to).length;

    if (buyTx > sellTx * 3) {
      honeypot = true;
    }

    // ---------------------------
    // 7. BLACKLIST (база)
    // ---------------------------
    const blacklist = [
      "0x000000000000000000000000000000000000dead",
      "0x1111111111111111111111111111111111111111"
    ];

    let blacklistHit = transfers.some(tx =>
      blacklist.includes(tx.to) || blacklist.includes(tx.from)
    );

    // ---------------------------
    // 8. ADVANCED SCAM LOGIC
    // ---------------------------
    let score = 0;
    let flags = [];

    if (txCount < 10) {
      score += 20;
      flags.push("Low activity");
    }

    if (uniqueUsers < 10) {
      score += 20;
      flags.push("Low holders");
    }

    const txPerUser = uniqueUsers > 0 ? txCount / uniqueUsers : 0;

    if (txPerUser > 3) {
      score += 25;
      flags.push("Bot-like activity");
    }

    if (volume > 1000000 && uniqueUsers < 100) {
      score += 25;
      flags.push("Wash trading suspected");
    }

    if (topHolderShare > 0.4) {
      score += 30;
      flags.push("Top holder controls large supply");
    }

    if (liquidityFlag) {
      score += 20;
      flags.push("Weak liquidity");
    }

    if (honeypot) {
      score += 40;
      flags.push("Possible honeypot");
    }

    if (blacklistHit) {
      score += 50;
      flags.push("Blacklisted interaction");
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
    let verdict = "No strong scam signals detected.";

    if (level === "HIGH RISK") {
      verdict = "High probability of scam (rug pull / honeypot).";
    }

    if (level === "SUSPICIOUS") {
      verdict = "Suspicious behavior detected. Investigate further.";
    }

    // ---------------------------
    // RESPONSE ДЛЯ UI
    // ---------------------------
    return res.status(200).json({
      token: tokenName,
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
