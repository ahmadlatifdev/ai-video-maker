// server.js — BossMind AI Video Maker (FINAL VIDEO ENGINE)

const express = require("express");
const https = require("https");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = (process.env.ADMIN_KEY || "").trim();

// 🔥 Your Make.com Video Engine Webhook
const VIDEO_ENGINE_WEBHOOK = "https://hook.us2.make.com/5mqiu79f31rufx8uj6sww4bnu6fh3xq5";

// --------------------
// Middleware
// --------------------
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

// --------------------
// Admin guard
// --------------------
function requireAdminKey(req, res, next) {
  if (!ADMIN_KEY) return next();
  const key = (req.headers["x-admin-key"] || "").toString().trim();
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

// --------------------
// Health
// --------------------
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ai-video-maker", hero: true, time: new Date().toISOString() });
});

app.get("/api/admin/health", requireAdminKey, (_req, res) => {
  res.json({ ok: true, service: "ai-video-maker", hero: true, time: new Date().toISOString() });
});

// --------------------
// Status
// --------------------
app.get("/api/admin/status/video", requireAdminKey, (_req, res) => {
  res.json({ ok: true, project: "video", time: new Date().toISOString(), value: { engine: "live" } });
});

// --------------------
// 🔥 BOSS MIND JOB ROUTER → VIDEO ENGINE
// --------------------
app.post("/api/admin/jobs", requireAdminKey, (req, res) => {
  const { job, scope } = req.body || {};
  if (!job) return res.status(400).json({ ok: false, error: "Missing job" });

  const jobId = `job_${Date.now()}`;

  const payload = JSON.stringify({
    jobId,
    job,
    scope: scope || "video",
    time: new Date().toISOString()
  });

  const url = new URL(VIDEO_ENGINE_WEBHOOK);

  const request = https.request(
    {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    },
    () => {}
  );

  request.on("error", err => console.error("Webhook error:", err));
  request.write(payload);
  request.end();

  console.log("Sent to Video Engine:", payload);

  res.json({ ok: true, jobId, status: "sent_to_video_engine" });
});

// --------------------
app.listen(PORT, () => {
  console.log("BossMind AI Video Maker LIVE on port", PORT);
});
