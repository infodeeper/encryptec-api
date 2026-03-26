export default async function handler(req, res) {
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

    const question = body?.input || "crypto question";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: "You are a crypto security expert assistant."
          },
          {
            role: "user",
            content: question
          }
        ]
      })
    });

    const data = await response.json();

    return res.status(200).json({
      result: data?.choices?.[0]?.message?.content || "No AI response"
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
