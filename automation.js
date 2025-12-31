// automation.js
const path = require("path");
const express = require("express");

const app = express();

// ---------- MIDDLEWARE ----------
app.use(express.json({ limit: "2mb" }));

// ✅ SERVE /public as site root (this fixes /automation.html, /admin.html, etc.)
app.use(express.static(path.join(__dirname, "public")));

// ---------- HEALTH ----------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "BossMind Core API",
    timestamp: new Date().toISOString(),
  });
});

// Optional admin health (kept compatible with your UI hints)
app.get("/api/admin/health", (req, res) => {
  res.json({
    status: "ok",
    service: "BossMind Admin API",
    timestamp: new Date().toISOString(),
  });
});

// ---------- SAFE DEFAULT ROUTES ----------
app.get("/", (req, res) => {
  // If you have public/index.html it will auto-serve.
  // Otherwise redirect to /admin
  res.redirect("/admin");
});

app.get("/admin", (req, res) => {
  // Serve admin.html if present, otherwise show a helpful message.
  const adminPath = path.join(__dirname, "public", "admin.html");
  res.sendFile(adminPath, (err) => {
    if (err) res.status(200).send("Admin UI file not found: public/admin.html");
  });
});

// ---------- PLACEHOLDER ADMIN ENDPOINTS (UI READY) ----------
// These keep your dashboard buttons from failing while you wire real logic.
// They are non-destructive.

app.post("/api/admin/jobs", (req, res) => {
  const { job, scope } = req.body || {};
  res.json({
    ok: true,
    message: `Job accepted: ${job || "unknown"} (scope: ${scope || "unknown"})`,
    received: { job, scope },
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/admin/sync", (req, res) => {
  res.json({
    ok: true,
    message: "Sync requested (placeholder).",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/admin/logs", (req, res) => {
  const scope = req.query.scope || "all";
  res.json({
    ok: true,
    scope,
    logs: [
      { level: "info", message: "Logs endpoint online (placeholder).", ts: new Date().toISOString() },
    ],
  });
});

app.post("/api/admin/maintenance", (req, res) => {
  const { mode } = req.body || {};
  res.json({
    ok: true,
    message: `Maintenance mode set to: ${mode || "off"} (placeholder).`,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/admin/switches", (req, res) => {
  const set = req.query.set || "builder";
  res.json({
    ok: true,
    set,
    switches: {
      deepseek: true,
      stripe_logs: true,
      webhooks: true,
      auto_disable: true,
      backups: true,
      notify: true,
    },
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/admin/switches", (req, res) => {
  const { set, key, action } = req.body || {};
  res.json({
    ok: true,
    message: `Switch updated (placeholder): set=${set} key=${key} action=${action}`,
    timestamp: new Date().toISOString(),
  });
});

// Status endpoints referenced in your admin UI
app.get("/api/admin/status/builder", (req, res) => {
  res.json({
    lastExport: "—",
    supabaseSync: "—",
    activeTheme: "—",
    errors24h: 0,
  });
});

app.get("/api/admin/status/video", (req, res) => {
  res.json({
    queueLength: 0,
    nextItem: "—",
    lastPublish: "—",
    errors24h: 0,
  });
});

app.get("/api/admin/status/system", (req, res) => {
  res.json({
    health: "ok",
    guardian: "online",
    lastBackup: "—",
    openIncidents: 0,
  });
});

// Queue endpoints used by automation.html
app.post("/api/admin/queue/sheet", (req, res) => {
  const { sheetId, tab } = req.body || {};
  res.json({
    ok: true,
    message: `Sheet linked (placeholder): ${sheetId || "—"} / ${tab || "—"}`,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/admin/queue/sync", (req, res) => {
  res.json({
    ok: true,
    message: "Queue sync triggered (placeholder).",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/admin/video/type", (req, res) => {
  const { type, mode } = req.body || {};
  res.json({
    ok: true,
    message: `Video type saved (placeholder): ${type || "—"} • ${mode || "—"}`,
    timestamp: new Date().toISOString(),
  });
});

// ---------- START ----------
const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`🚀 BossMind Web Server running on port ${PORT}`);
});
