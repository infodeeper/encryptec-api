export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const address = body?.input;

    if (!address) {
      return res.status(200).json({
        result: "❌ Enter wallet address"
      });
    }

    // 🔹 1. BALANCE
    const balanceRes = await fetch(process.env.ALCHEMY_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1
      })
    });

    const balanceData = await balanceRes.json();
    const balanceEth = parseInt(balanceData.result, 16) / 1e18;

    // 🔹 2. OUTGOING TX
    const outRes = await fetch(process.env.ALCHEMY_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          fromAddress: address,
          category: ["external", "erc20"],
          maxCount: "0x32"
        }],
        id: 2
      })
    });

    const outData = await outRes.json();
    const outgoingTxs = outData?.result?.transfers || [];

    // 🔹 3. INCOMING TX
    const inRes = await fetch(process.env.ALCHEMY_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          toAddress: address,
          category: ["external", "erc20"],
          maxCount: "0x32"
        }],
        id: 3
      })
    });

    const inData = await inRes.json();
    const incomingTxs = inData?.result?.transfers || [];

    const outgoing = outgoingTxs.length;
    const incoming = incomingTxs.length;
    const txCount = outgoing + incoming;

    // 🔹 4. TOKENS (ERC20)
    const tokensMap = {};

    outgoingTxs.concat(incomingTxs).forEach(tx => {
      if (tx.asset && tx.value) {
        if (!tokensMap[tx.asset]) {
          tokensMap[tx.asset] = 0;
        }
        tokensMap[tx.asset] += Number(tx.value);
      }
    });

    const tokens = Object.entries(tokensMap)
      .map(([symbol, value]) => `${symbol}: ${value.toFixed(2)}`)
      .slice(0, 5);

    // 🔹 5. CONTRACT INTERACTIONS (DeFi)
    const contractInteractions = outgoingTxs.filter(tx => tx.to && tx.rawContract);

    // 🔹 6. LABELS (простая логика)
    let labels = [];

    if (contractInteractions.length > 5) {
      labels.push("DeFi User");
    }

    if (txCount > 20) {
      labels.push("Active Wallet");
    }

    if (balanceEth > 10) {
      labels.push("Whale");
    }

    if (labels.length === 0) {
      labels.push("Normal User");
    }

    // 🔥 RISK ENGINE
    let risk = 0;
    let flags = [];

    if (balanceEth < 0.01) {
      risk += 20;
      flags.push("Low balance");
    }

    if (txCount === 0) {
      risk += 40;
      flags.push("No activity");
    }

    if (contractInteractions.length > 10) {
      risk += 20;
      flags.push("Heavy contract usage");
    }

    if (outgoing > incoming * 2) {
      risk += 20;
      flags.push("High outgoing flow");
    }

    let level = "Low";
    if (risk > 70) level = "High";
    else if (risk > 40) level = "Medium";

    return res.status(200).json({
      result: `
Wallet: ${address}

📊 CORE
Balance: ${balanceEth.toFixed(4)} ETH
Transactions: ${txCount}

📈 FLOW
Incoming: ${incoming}
Outgoing: ${outgoing}

🪙 TOKENS
${tokens.length ? tokens.join("\n") : "No tokens detected"}

🧩 DeFi Activity
Interactions: ${contractInteractions.length}

🏷 LABELS
${labels.join(", ")}

🚨 RISK
Score: ${risk}
Level: ${level}

Flags:
${flags.map(f => "- " + f).join("\n") || "None"}

Status: Full Analysis ✅
`
    });

  } catch (err) {
    return res.status(200).json({
      result: "❌ Error",
      error: err.message
    });
  }
}
