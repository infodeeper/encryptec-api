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

    // 🔹 1. БАЛАНС
    const balanceRes = await fetch(process.env.ALCHEMY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1
      })
    });

    const balanceData = await balanceRes.json();
    const balanceWei = parseInt(balanceData.result, 16);
    const balanceEth = balanceWei / 1e18;

    // 🔹 2. ТРАНЗАКЦИИ (через Alchemy)
    const txRes = await fetch(process.env.ALCHEMY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          fromAddress: address,
          category: ["external", "erc20"],
          maxCount: "0x10"
        }],
        id: 2
      })
    });

    const txData = await txRes.json();
    const txs = txData?.result?.transfers || [];

    const txCount = txs.length;

    // 🔹 3. ВХОД / ВЫХОД
    let outgoing = txs.length;
    let incoming = 0; // (упрощенно)

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

    if (txCount > 15) {
      risk += 20;
      flags.push("High activity");
    }

    let level = "Low";
    if (risk > 60) level = "High";
    else if (risk > 30) level = "Medium";

    return res.status(200).json({
      result: `
Wallet: ${address}

📊 CORE
Balance: ${balanceEth.toFixed(4)} ETH
Transactions (last): ${txCount}

📈 ACTIVITY
Outgoing: ${outgoing}
Incoming: ${incoming}

🚨 RISK
Score: ${risk}
Level: ${level}

Flags:
${flags.map(f => "- " + f).join("\n")}

Status: Advanced analysis ✅
`
    });

  } catch (err) {
    return res.status(200).json({
      result: "❌ Error",
      error: err.message
    });
  }
}
