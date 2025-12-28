// automation.js
const express = require("express");
const app = express();

const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

// Middleware
app.use(express.json({ limit: "2mb" }));

/* ============================
   BOSSMIND RUNTIME STATE
============================ */
let tickCounter = 0;
const STATE = {
  app: "ai-video-maker",
  bossmind: true,
  startedAt: new Date().toISOString(),
  lastTickAt: null,
  tickCount: 0,
  lastError: null,
};

/* ============================
   STABILITY AI INTEGRATION
============================ */
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;

// SDXL Text-to-Image endpoint (commonly used)
// If your Stability account requires a different endpoint/model, we can adjust after first test.
const STABILITY_API_URL =
  "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";

async function generateImageBase64(prompt) {
  if (!STABILITY_API_KEY) {
    console.warn("⚠️ STABILITY_API_KEY not set in environment.");
    return { ok: false, error: "STABILITY_API_KEY missing" };
  }

  // Node 18+ has global fetch. (Railway usually runs Node 18+)
  if (typeof fetch !== "function") {
    return { ok: false, error: "fetch is not available in this Node runtime" };
  }

  try {
    const r = await fetch(STABILITY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STABILITY_API_KEY}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt }],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        steps: 30,
        samples: 1,
      }),
    });

    const text = await r.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // keep raw text
    }

    if (!r.ok) {
      return {
        ok: false,
        error: `Stability API error: ${r.status}`,
        details: data || text,
      };
    }

    const b64 = data?.artifacts?.[0]?.base64 || null;
    if (!b64) {
      return { ok: false, error: "No base64 image returned", details: data };
    }

    return { ok: true, base64: b64 };
  } catch (e) {
    return { ok: false, error: e?.message || "Unknown error" };
  }
}

/* ============================
   CORE ENDPOINTS
============================ */

// Health
app.get(["/", "/health"], (req, res) => {
  res.json({
    status: "online",
    service: "BossMind Core",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    automation_ticks: tickCounter,
  });
});

// Projects status
app.get("/api/projects", (req, res) => {
  res.json({
    projects: [
      {
        name: "AI Video Maker",
        url: "https://video.bossmind.ai",
        status: "online",
        db: "bossmind_ai_video",
      },
      {
        name: "AI Builder",
        url: "https://ai-builder.bossmind.ai",
        status: "setup",
        db: "bossmind_ai_builder",
      },
      {
        name: "E-Commerce AI",
        url: "https://ecom.bossmind.ai",
        status: "offline",
        db: "bossmind_ecom",
      },
    ],
  });
});

// Admin status (later can protect)
app.get("/admin/status", (req, res) => {
  res.json({
    system: "BossMind 24/7",
    version: "1.0",
    automation_running: true,
    last_tick: STATE.lastTickAt,
    tickCounter,
  });
});

/* ============================
   IMAGE GENERATION ENDPOINT
   (THIS is what your curl calls)
============================ */

// Optional helper GET so browser doesn’t show confusion
app.get("/api/generate/image", (req, res) => {
  res.status(200).json({
    ok: true,
    info: "Use POST /api/generate/image with JSON body: { \"prompt\": \"...\" }",
  });
});

app.post("/api/generate/image", async (req, res) => {
  const prompt = (req.body?.prompt || "").trim();
  if (!prompt) return res.status(400).json({ ok: false, error: "Prompt required" });

  const out = await generateImageBase64(prompt);
  if (!out.ok) return res.status(502).json({ ok: false, ...out });

  // Return as base64 data URL (easy to preview in browser/app)
  res.json({
    ok: true,
    prompt,
    image_url: `data:image/png;base64,${out.base64}`,
    generated_at: new Date().toISOString(),
  });
});

/* ============================
   24/7 AUTOMATION LOOP
============================ */
function automationLoop() {
  try {
    tickCounter++;
    STATE.tickCount = tickCounter;
    STATE.lastTickAt = new Date().toISOString();
    STATE.lastError = null;

    console.log(`🤖 BossMind Tick #${tickCounter} – ${STATE.lastTickAt}`);

    // Example: monitor project URL (placeholder)
    console.log(`   ✅ https://video.bossmind.ai – monitored`);
  } catch (err) {
    STATE.lastError = err?.message || String(err);
    console.error("❌ Tick error:", STATE.lastError);
  }
}

// Tick every 10 seconds
setInterval(automationLoop, 10000);

/* ============================
   START SERVER
============================ */
app.listen(PORT, HOST, () => {
  console.log(`🚀 BossMind Core API listening on http://${HOST}:${PORT}`);
  automationLoop(); // first tick immediately
});
