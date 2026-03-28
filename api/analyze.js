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

    const response = await fetch("https://rpc.ankr.com/eth", {
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

    const data = await response.json();

    if (!data.result) {
      return res.status(200).json({
        result: "❌ RPC error",
        debug: data
      });
    }

    const balanceWei = parseInt(data.result, 16);
    const balanceEth = balanceWei / 1e18;

    return res.status(200).json({
      result: `
Wallet: ${address}

Balance: ${balanceEth.toFixed(6)} ETH

Status: Ankr RPC working ✅
`
    });

  } catch (err) {
    return res.status(200).json({
      result: "❌ Server error",
      error: err.message
    });
  }
}
