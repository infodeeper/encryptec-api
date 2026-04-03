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
        result: "❌ Enter token contract address"
      });
    }

    // ---------------------------
    // SAFE FETCH
    // ---------------------------
    let transfers = [];

    try {
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

      transfers = txData?.result?.transfers || [];

    } catch (e) {
      return res.status(200).json({
        result: "⚠️ RPC error (Alchemy issue)"
      });
    }

    const txCount = transfers.length;

    // ---------------------------
    // USERS
    // ---------------------------
    const users = new Set();

    transfers.forEach(tx => {
      if (tx.from) users.add(tx.from);
      if (tx.to) users.add(tx.to);
    });

    const uniqueUsers = users.size;

    // ---------------------------
    // VOLUME
    // ---------------------------
    let volume = 0;

    transfers.forEach(tx => {
      if (tx.value) volume += Number(tx.value);
    });

    // ---------------------------
    // ACTIVITY
    // ---------------------------
    let activity = "Low";
    if (txCount > 50) activity = "High";
    else if (txCount > 10) activity = "Medium";

    // ---------------------------
    // SCAM DETECTION
    // ---------------------------
    let scamScore = 0;
    let flags = [];

    if (txCount < 5) {
      scamScore += 30;
      flags.push("Very low activity");
    }

    if (uniqueUsers < 5) {
      scamScore += 30;
      flags.push("Very few users");
    }

    if (volume === 0) {
      scamScore += 20;
      flags.push("No volume");
    }

    if (txCount > 30 && uniqueUsers < 10) {
      scamScore += 20;
      flags.push("Suspicious pattern");
    }

    let level = "Safe";
    if (scamScore > 70) level = "High Risk";
    else if (scamScore > 40) level = "Suspicious";

    // ---------------------------
    // FINAL (ВСЕГДА RESULT!)
    // ---------------------------
    return res.status(200).json({
      result: `
Token: ${token}

📊 Activity:
Transactions: ${txCount}
Users: ${uniqueUsers}
Volume: ${volume.toFixed(2)}

📈 Status:
${activity}

🕵️ Scam Analysis:
Score: ${scamScore}
Level: ${level}

Signals:
${flags.length ? flags.map(f => "- " + f).join("\n") : "None"}

Status: Scan Complete ✅
`
    });

  } catch (err) {
    return res.status(200).json({
      result: "❌ Fatal error",
      error: err.message
    });
  }
}
    return res.status(200).json({
      result: "❌ Scan Error",
      error: err.message
    });
  }
}
