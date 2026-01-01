// server.js — Minimal Video Backend (BossMind)
// Purpose: add real backend routes without changing dashboard UI.
// Provides:
//   GET  /health
//   GET  /api/video/list
//   POST /api/video/render
//   GET  /api/video/status/:id
//
// NOTE: This is a minimal “plumbing” backend. It returns preview URLs
// (demo placeholders) so the dashboard can show "watch links" immediately.
// You can later replace preview_url with real rendered files.

const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "2mb" }));

// Serve the existing UI (public/automation.html)
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR, { etag: true, maxAge: "1h" }));

// Simple in-memory store (safe for minimal backend)
const jobs = new Map(); // id -> job

function nowISO() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomBytes(10).toString("hex");
}

function makeDemoPreviewUrl() {
  // Demo video URL (publicly accessible). Replace later with your real render storage URL.
  return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
}

// Health (used by your Ops Console ping)
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker-minimal-backend",
    time: nowISO(),
    jobs: jobs.size,
  });
});

// List videos/jobs for dashboard
app.get("/api/video/list", (_req, res) => {
  const list = Array.from(jobs.values())
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((j) => ({
      id: j.id,
      status: j.status,
      title: j.title,
      language: j.language,
      duration_minutes: j.duration_minutes,
      created_at: j.created_at,
      updated_at: j.updated_at,
      preview_url: j.preview_url,
    }));

  res.json({ ok: true, count: list.length, items: list });
});

// Create a render job (minimal stub)
// Body (optional):
// { title, language, duration_minutes, source: { sheet_row_id, prompt } }
app.post("/api/video/render", (req, res) => {
  const id = makeId();

  const title = (req.body?.title || "Untitled Video").toString().slice(0, 120);
  const language = (req.body?.language || "auto").toString().slice(0, 24);
  const duration_minutes = Number(req.body?.duration_minutes || 10);

  const job = {
    id,
    status: "queued",
    title,
    language,
    duration_minutes,
    created_at: nowISO(),
    updated_at: nowISO(),
    // Placeholder preview URL so you can "watch online now" immediately.
    // Replace later with your real rendered file location (Supabase/Cloudflare R2/etc.)
    preview_url: makeDemoPreviewUrl(),
  };

  jobs.set(id, job);

  // Simulate a quick state progression (queued -> rendering -> ready)
  setTimeout(() => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = "rendering";
    j.updated_at = nowISO();
  }, 300);

  setTimeout(() => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = "ready";
    j.updated_at = nowISO();
  }, 1200);

  res.status(202).json({
    ok: true,
    id,
    status: job.status,
    preview_url: job.preview_url,
  });
});

// Status for a single job
app.get("/api/video/status/:id", (req, res) => {
  const id = req.params.id;
  const job = jobs.get(id);
  if (!job) {
    return res.status(404).json({ ok: false, error: "not_found", id });
  }
  res.json({
    ok: true,
    id: job.id,
    status: job.status,
    title: job.title,
    language: job.language,
    duration_minutes: job.duration_minutes,
    created_at: job.created_at,
    updated_at: job.updated_at,
    preview_url: job.preview_url,
  });
});

// Fallback: open the UI easily
app.get("/", (_req, res) => {
  res.redirect("/automation.html");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[ai-video-maker] backend listening on :${PORT}`);
});
