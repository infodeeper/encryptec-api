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

    const input = body?.input || "wallet";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          {
            role: "user",
            content: `Analyze wallet: ${input}`
          }
        ]
      })
    });

    const data = await response.json();

    // 🔥 ВСЕГДА ВОЗВРАЩАЕМ ПОЛНЫЙ ОТВЕТ
    return res.status(200).json({
      full: data
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
