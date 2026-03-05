import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/tts", async (req, res) => {
  try {
    const { text, voice = "marin", model = "gpt-4o-mini-tts" } = req.body || {};
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required" });
    if (text.length > 6000) return res.status(400).json({ error: "text too long" });

    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        format: "mp3",
        instructions:
          "Sound like a warm, confident communication coach. Natural pacing and pauses. Friendly but authoritative. Not robotic."
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).send(t);
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: "server_error", detail: String(e) });
  }
});

app.post("/feedback", async (req, res) => {
  try {
    const { transcript } = req.body || {};
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    if (!transcript || typeof transcript !== "string") return res.status(400).json({ error: "transcript is required" });

    const prompt = `
You are a communication coach. Analyze this transcript and return JSON with:
- summary (1 sentence)
- strengths (3 bullets)
- improvements (3 bullets)
- fillerWords (array)
- suggestedRewrite (2-3 sentences, clearer/confident)
Transcript:
${transcript}
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).send(t);
    }

    const data = await r.json();
    res.json({ ok: true, raw: data.choices?.[0]?.message?.content ?? "" });
  } catch (e) {
    res.status(500).json({ error: "server_error", detail: String(e) });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Server running on", port));
