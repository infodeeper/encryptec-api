export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const address = body?.input;

    // 🔹 BALANCE
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

    // 🔹 OUTGOING
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
          maxCount: "0x10"
        }],
        id: 2
      })
    });

    const outData = await outRes.json();

    // 🔹 INCOMING
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
          maxCount: "0x10"
        }],
        id: 3
      })
    });

    const inData = await inRes.json();

    return res.status(200).json({
      debug: {
        balance: balanceData,
        outgoing: outData,
        incoming: inData
      }
    });

  } catch (err) {
    return res.status(200).json({
      error: err.message
    });
  }
}
