export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body;

    const address = body?.input;

    if (!address) {
      return res.status(200).json({
        result: "❌ Enter wallet address"
      });
    }

    // ---------------------------
    // 1. BALANCE
    // ---------------------------
    const balanceRes = await fetch(process.env.ALCHEMY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1
      })
    });

    const balanceData = await balanceRes.json();
    const balance = parseInt(balanceData.result || "0x0", 16) / 1e18;

    // ---------------------------
    // 2. OUTGOING TX
    // ---------------------------
    const outRes = await fetch(process.env.ALCHEMY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          fromAddress: address,
          category: ["external", "erc20"],
          withMetadata: true,
          maxCount: "0x32"
        }],
        id: 2
      })
    });

    const outData = await outRes.json();
    const outgoingTxs = outData?.result?.transfers || [];

    // ---------------------------
    // 3. INCOMING TX
    // ---------------------------
    const inRes = await fetch(process.env.ALCHEMY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          toAddress: address,
          category: ["external", "erc20"],
          withMetadata: true,
          maxCount: "0x32"
        }],
        id: 3
      })
    });

    const inData = await inRes.json();
    const incomingTxs = inData?.result?.transfers || [];

    const outgoing = outgoingTxs.length;
    const incoming = incomingTxs.length;
    const totalTx = outgoing + incoming;

    // ---------------------------
    // 4. TOKENS (ERC20)
    // ---------------------------
    const tokenMap = {};

    [...incomingTxs, ...outgoingTxs].forEach(tx => {
      if (tx.asset && tx.value) {
        tokenMap[tx.asset] = (tokenMap[tx.asset] || 0) + Number(tx.value);
      }
    });

    const tokens = Object.entries(tokenMap)
      .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
      .slice(0, 5);

    // ---------------------------
    // 5. ACTIVITY
    // ---------------------------
    const isActive = totalTx > 5;

    // ---------------------------
    // 6. RISK ENGINE
    // ---------------------------
    let risk = 0;
    let flags = [];

    if (balance < 0.01) {
      risk += 20;
      flags.push("Low balance");
    }

    if (totalTx === 0) {
      risk += 40;
      flags.push("No activity");
    }

    if (outgoing > incoming * 2) {
      risk += 20;
      flags.push("High outflow");
    }

    if (totalTx > 30) {
      risk += 15;
      flags.push("High activity");
    }

    let level = "Low";
    if (risk > 60) level = "High";
    else if (risk > 30) level = "Medium";

    // ---------------------------
    // FINAL RESPONSE (ВАЖНО)
    // ---------------------------
    return res.status(200).json({
      result: `
Wallet: ${address}

💰 Balance: ${balance.toFixed(4)} ETH

📊 Transactions:
- Total: ${totalTx}
- Incoming: ${incoming}
- Outgoing: ${outgoing}

🪙 Tokens:
${tokens.length ? tokens.join("\n") : "No tokens detected"}

📈 Activity:
${isActive ? "Active wallet" : "Low activity"}

🚨 Risk:
Score: ${risk}
Level: ${level}

Flags:
${flags.length ? flags.join("\n") : "None"}

Status: Full Analysis ✅
`
    });

  } catch (err) {
    return res.status(200).json({
      result: "❌ ERROR",
      error: err.message
    });
  }
}
  } catch (err) {
    return res.status(200).json({
      result: "ERROR",
      error: err.message
    });
  }
}
