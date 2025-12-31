// automation.js (CommonJS, Node 18+)
// Uses built-in global fetch (no node-fetch)

const express = require("express");

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 8080;

// Root
app.get("/", (_req, res) => {
  res.status(200).send("Hello World");
});

// Health
app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    status: "healthy",
    hasStabilityKey: Boolean(process.env.STABILITY_API_KEY),
    engine: process.env.STABILITY_ENGINE || "stable-diffusion-xl-1024-v1-0",
  });
});

// Example endpoint: generate image via Stability (optional)
// If no key, returns 400 instead of crashing.
app.post("/generate", async (req, res) => {
  try {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ ok: false, error: "Missing STABILITY_API_KEY" });
    }

    const prompt = (req.body && req.body.prompt) ? String(req.body.prompt) : "A cinematic scene";
    const engine = process.env.STABILITY_ENGINE || "stable-diffusion-xl-1024-v1-0";

    // Stability API endpoint may vary by product/version; this is a safe example call shape.
    // If your account uses a different endpoint, we can adjust after it’s running.
    const url = `https://api.stability.ai/v1/generation/${engine}/text-to-image`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt, weight: 1 }],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 30,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: "stability_error", details: data });
    }

    return res.status(200).json({ ok: true, engine, result: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "server_error", details: String(err?.message || err) });
  }
});

// Start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BossMind Core API listening on http://0.0.0.0:${PORT}`);
});
