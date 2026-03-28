export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(200).json({ result: "Use POST" });
  }

  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body;

    const address = body?.input;

    if (!address) {
      return res.status(200).json({ result: "No wallet address" });
    }

    // 🔹 1. Баланс
    const balanceRes = await fetch(
      `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${process.env.ETHERSCAN_API_KEY}`
    );
    const balanceData = await balanceRes.json();
    const balance = (balanceData.result / 1e18);

    // 🔹 2. Транзакции (20 последних)
    const txRes = await fetch(
      `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&page=1&offset=20&sort=desc&apikey=${process.env.ETHERSCAN_API_KEY}`
    );
    const txData = await txRes.json();
    const txs = txData.result || [];

    const txCount = txs.length;

    // 🔹 3. Возраст кошелька
    let walletAgeDays = 0;
    if (txs.length > 0) {
      const firstTx = txs[txs.length - 1];
      const firstTime = parseInt(firstTx.timeStamp) * 1000;
      walletAgeDays = Math.floor((Date.now() - firstTime) / (1000 * 60 * 60 * 24));
    }

    // 🔹 4. Уникальные адреса
    const uniqueAddresses = new Set();
    let incoming = 0;
    let outgoing = 0;

    txs.forEach(tx => {
      uniqueAddresses.add(tx.from);
      uniqueAddresses.add(tx.to);

      if (tx.to.toLowerCase() === address.toLowerCase()) incoming++;
      if (tx.from.toLowerCase() === address.toLowerCase()) outgoing++;
    });

    // 🔹 5. Средний размер транзакции
    let avgTx = 0;
    if (txs.length > 0) {
      const total = txs.reduce((sum, tx) => sum + Number(tx.value), 0);
      avgTx = total / txs.length / 1e18;
    }

    // 🔥 RISK ENGINE
    let risk = 0;
    let flags = [];

    if (walletAgeDays < 7) {
      risk += 30;
      flags.push("New wallet");
    }

    if (balance < 0.01) {
      risk += 20;
      flags.push("Low balance");
    }

    if (txCount === 0) {
      risk += 40;
      flags.push("No activity");
    }

    if (uniqueAddresses.size < 5) {
      risk += 20;
      flags.push("Low interaction diversity");
    }

    if (outgoing > incoming * 3) {
      risk += 15;
      flags.push("High outgoing activity");
    }

    let level = "Low";
    if (risk > 70) level = "High";
    else if (risk > 40) level = "Medium";

    return res.status(200).json({
      result: `
Wallet: ${address}

📊 CORE
Balance: ${balance.toFixed(4)} ETH
Transactions (last 20): ${txCount}
Wallet age: ${walletAgeDays} days

📈 BEHAVIOR
Incoming: ${incoming}
Outgoing: ${outgoing}
Unique addresses: ${uniqueAddresses.size}
Avg Tx: ${avgTx.toFixed(4)} ETH

🚨 RISK ANALYSIS
Risk Score: ${risk}
Risk Level: ${level}

Flags:
${flags.map(f => "- " + f).join("\n")}

🧠 INSIGHT
${level === "High" ? "Potentially risky wallet" : "No critical issues detected"}

`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
