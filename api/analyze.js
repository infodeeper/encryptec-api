export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // ✅ проверка ключа
    if (!process.env.ETHERSCAN_API_KEY) {
      return res.status(200).json({
        result: "❌ API key not found in Vercel"
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const address = body?.input;

    if (!address) {
      return res.status(200).json({
        result: "❌ No wallet address provided"
      });
    }

    // ✅ запрос баланса
    const balanceRes = await fetch(
      `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${process.env.ETHERSCAN_API_KEY}`
    );

    const balanceData = await balanceRes.json();

    if (!balanceData.result) {
      return res.status(200).json({
        result: "❌ Etherscan error",
        debug: balanceData
      });
    }

    const balance = (balanceData.result / 1e18).toFixed(4);

    return res.status(200).json({
      result: `
Wallet: ${address}

Balance: ${balance} ETH

✅ API WORKING
`
    });

  } catch (err) {
    return res.status(200).json({
      result: "❌ SERVER ERROR",
      error: err.message
    });
  }
}
