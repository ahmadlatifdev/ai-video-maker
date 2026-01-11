// server.js — BossMind AI Video Maker (LIVE)
// ✅ CommonJS version (fixes: "Cannot use import statement outside a module")

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// --------------------
// Basics
// --------------------
const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = (process.env.ADMIN_KEY || "").trim(); // optional

// --------------------
// Middleware
// --------------------
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Simple request log
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - t0;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Serve static UI (admin.html, assets, etc.)
app.use(express.static(path.join(__dirname, "public")));

// --------------------
// Optional Admin Key Guard
// (Only enforced if ADMIN_KEY env var is set)
// --------------------
function requireAdminKey(req, res, next) {
  if (!ADMIN_KEY) return next(); // not enabled
  const key = (req.headers["x-admin-key"] || "").toString().trim();
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized (x-admin-key required)" });
  }
  next();
}

// --------------------
// Health
// --------------------
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker",
    hero: true,
    time: new Date().toISOString(),
  });
});

app.get("/api/admin/health", requireAdminKey, (_req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker",
    hero: true,
    time: new Date().toISOString(),
  });
});

// --------------------
// Status Snapshots (expected by your Admin UI)
// --------------------
app.get("/api/admin/status/system", requireAdminKey, (_req, res) => {
  res.json({
    ok: true,
    project: "system",
    service: "ai-video-maker",
    time: new Date().toISOString(),
    value: {
      uptimeSec: Math.round(process.uptime()),
      node: process.version,
      env: { hasAdminKey: Boolean(ADMIN_KEY) },
    },
  });
});

app.get("/api/admin/status/video", requireAdminKey, (_req, res) => {
  res.json({
    ok: true,
    project: "video",
    time: new Date().toISOString(),
    value: {
      queue: "ready",
      worker: "ready",
      lastJobId: null,
    },
  });
});

app.get("/api/admin/status/builder", requireAdminKey, (_req, res) => {
  res.json({
    ok: true,
    project: "builder",
    time: new Date().toISOString(),
    value: {
      note: "Builder service is separate (this endpoint stays compatible for Admin UI).",
    },
  });
});

// --------------------
// ✅ FIX: Missing BossMind Job Endpoint
// Admin UI calls: POST /api/admin/jobs { job, scope }
// --------------------
app.post("/api/admin/jobs", requireAdminKey, async (req, res) => {
  try {
    const { job, scope } = req.body || {};

    if (!job) {
      return res.status(400).json({ ok: false, error: "Missing job type" });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const accepted = {
      ok: true,
      jobId,
      job,
      scope: scope || "video",
      status: "queued",
      time: new Date().toISOString(),
    };

    console.log("BossMind Job Accepted:", accepted);
    res.json(accepted);
  } catch (e) {
    console.error("BossMind Job Error:", e);
    res.status(500).json({ ok: false, error: (e && e.message) ? e.message : "Unknown error" });
  }
});

// --------------------
// Convenience: route to admin UI
// --------------------
app.get("/admin", (_req, res) => {
  res.redirect("/admin.html");
});

// --------------------
// 404 fallback (API + UI)
// --------------------
app.use((req, res) => {
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: "API route not found" });
  }
  return res.redirect("/admin.html");
});

// --------------------
// Start
// --------------------
app.listen(PORT, () => {
  console.log(`BossMind AI Video Maker LIVE on port ${PORT}`);
});
