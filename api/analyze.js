export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(200).json({ result: "Use POST" });
  }

  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body;

    const wallet = body?.input || "unknown wallet";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-site.com",
        "X-Title": "Encryptec"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `
You are a professional blockchain security analyst.

Return response STRICTLY in this format:

Risk Score: (0-100)
Risk Level: (Low / Medium / High)

Summary:
(short explanation)

Red Flags:
- ...
- ...

Recommendations:
- ...
- ...
`
          },
          {
            role: "user",
            content: `Analyze this crypto wallet: ${wallet}`
          }
        ]
      })
    });

    const data = await response.json();

    // DEBUG если что-то пошло не так
    if (!data.choices) {
      return res.status(200).json({
        result: "AI error",
        debug: data
      });
    }

    return res.status(200).json({
      result: data.choices[0].message.content
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
