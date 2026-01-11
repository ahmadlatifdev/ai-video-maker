/**
 * BossMind – AI Video Maker
 * Hero Page + API Server
 * NO KEYS MODE
 */

const express = require("express");
const path = require("path");

const app = express();

/* ----------------------------------------------------
   CONFIG
---------------------------------------------------- */

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

/* ----------------------------------------------------
   MIDDLEWARE
---------------------------------------------------- */

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

/* ----------------------------------------------------
   HERO
---------------------------------------------------- */

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* ----------------------------------------------------
   HEALTH (public + admin alias)
---------------------------------------------------- */

function healthPayload() {
  return {
    ok: true,
    service: "ai-video-maker",
    hero: true,
    time: new Date().toISOString()
  };
}

app.get("/health", (req, res) => res.json(healthPayload()));
app.get("/api/admin/health", (req, res) => res.json(healthPayload()));

/* ----------------------------------------------------
   STATUS (public)
---------------------------------------------------- */

app.get("/status", (req, res) => {
  res.json({
    bossmind: "AI Video Maker",
    state: "READY",
    port: Number(PORT),
    time: new Date().toISOString()
  });
});

/* ----------------------------------------------------
   ADMIN JOBS + STATUS (what the Admin UI expects)
---------------------------------------------------- */

// Minimal in-memory job log (NO KEYS MODE)
const JOBS = [];
const MAX_JOBS = 50;

function pushJob(job) {
  JOBS.unshift(job);
  if (JOBS.length > MAX_JOBS) JOBS.length = MAX_JOBS;
}

// POST /api/admin/jobs  { job, scope }
app.post("/api/admin/jobs", (req, res) => {
  const job = (req.body?.job || "").toString().trim();
  const scope = (req.body?.scope || "video").toString().trim();

  if (!job) {
    return res.status(400).json({ ok: false, error: "Missing 'job' in body" });
  }

  const record = {
    id: `job_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    job,
    scope,
    status: "QUEUED",
    receivedAt: new Date().toISOString()
  };

  pushJob(record);

  // In NO-KEYS mode we accept jobs and log them (worker can pick them later)
  return res.json({
    ok: true,
    accepted: true,
    queued: true,
    record
  });
});

// Optional: view last jobs
app.get("/api/admin/jobs", (req, res) => {
  res.json({ ok: true, items: JOBS });
});

// Status endpoints expected by UI
app.get("/api/admin/status/video", (req, res) => {
  res.json({
    ok: true,
    scope: "video",
    state: "LIVE",
    pendingJobs: JOBS.filter(j => j.scope === "video" && j.status === "QUEUED").length,
    lastJob: JOBS.find(j => j.scope === "video") || null,
    time: new Date().toISOString()
  });
});

app.get("/api/admin/status/builder", (req, res) => {
  res.json({
    ok: true,
    scope: "builder",
    state: "STANDBY",
    note: "Builder status is handled by the Builder project service.",
    time: new Date().toISOString()
  });
});

app.get("/api/admin/status/system", (req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker",
    state: "LIVE",
    port: Number(PORT),
    uptimeSec: Math.floor(process.uptime()),
    jobsStored: JOBS.length,
    time: new Date().toISOString()
  });
});

/* ----------------------------------------------------
   404 (API only)
---------------------------------------------------- */

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: `Not Found: ${req.method} ${req.path}` });
  }
  return next();
});

/* ----------------------------------------------------
   START SERVER
---------------------------------------------------- */

app.listen(PORT, () => {
  console.log("BossMind AI Video Maker LIVE on port", PORT);
});
