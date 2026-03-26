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

    const token = body?.input || "unknown";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `
You are a crypto scam detection expert.

Return:

Scam Probability: (0-100%)
Verdict: (Safe / Suspicious / Scam)

Reasons:
- ...
- ...

Advice:
- ...
- ...
`
          },
          {
            role: "user",
            content: `Check this token/project: ${token}`
          }
        ]
      })
    });

    const data = await response.json();

    if (!data.choices) {
      return res.status(200).json({ result: "AI error", debug: data });
    }

    return res.status(200).json({
      result: data.choices[0].message.content
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
