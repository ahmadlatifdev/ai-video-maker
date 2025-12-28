"use strict";

const http = require("http");
const url = require("url");

/* ===============================
   Railway Runtime Configuration
================================ */
const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";

/* ===============================
   BossMind Runtime State
================================ */
const STATE = {
  app: "ai-video-maker",
  bossmind: true,
  startedAt: new Date().toISOString(),
  lastTickAt: null,
  tickCount: 0,
  lastError: null,
  version: "dual-mode-automation+api",
};

const JOBS = new Map(); // id -> job
let NEXT_JOB_ID = 1;

/* ===============================
   Helpers
================================ */
function nowIso() {
  return new Date().toISOString();
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, statusCode, text, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  });
  res.end(text);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      // simple protection
      if (data.length > 1_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function newJob({ prompt, meta }) {
  const id = String(NEXT_JOB_ID++);
  const job = {
    id,
    type: "video_generate",
    status: "queued", // queued | running | done | failed
    createdAt: nowIso(),
    updatedAt: nowIso(),
    prompt: String(prompt || ""),
    meta: meta && typeof meta === "object" ? meta : {},
    progress: 0,
    result: null,
    error: null,
  };
  JOBS.set(id, job);
  return job;
}

function listJobs(limit = 50) {
  const arr = Array.from(JOBS.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return arr.slice(0, Math.max(1, Math.min(200, Number(limit) || 50)));
}

/* ===============================
   Automation Tick
   - keeps 24/7 alive
   - simulates job progression
================================ */
function runAutomationTick() {
  try {
    STATE.tickCount += 1;
    STATE.lastTickAt = nowIso();

    // Simulate job runner (non-blocking, fast)
    // Only one running at a time to keep it simple
    let running = null;
    for (const j of JOBS.values()) {
      if (j.status === "running") {
        running = j;
        break;
      }
    }

    if (!running) {
      // pick next queued
      for (const j of JOBS.values()) {
        if (j.status === "queued") {
          j.status = "running";
          j.updatedAt = nowIso();
          running = j;
          break;
        }
      }
    }

    if (running) {
      // advance progress
      running.progress = Math.min(100, (running.progress || 0) + 5);
      running.updatedAt = nowIso();

      if (running.progress >= 100) {
        running.status = "done";
        running.result = {
          message: "stub video generated (connect Stability/Runway/Luma next)",
          videoUrl: null,
          finishedAt: nowIso(),
        };
        running.updatedAt = nowIso();
      }
    }

    // keep logs light
    if (STATE.tickCount === 1) {
      console.log("🤖 BossMind 24/7 Automation Started");
    }
    if (STATE.tickCount % 10 === 0) {
      console.log(`🟣 Tick #${STATE.tickCount} { message: 'tick ok' }`);
    }
  } catch (err) {
    STATE.lastError = err && err.message ? err.message : String(err);
    console.error("❌ Tick error:", err);
  }
}

/* ===============================
   HTTP Server (API + Health)
================================ */
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  const parsed = url.parse(req.url || "/", true);
  const path = parsed.pathname || "/";
  const method = (req.method || "GET").toUpperCase();

  // Basic routes
  if (method === "GET" && (path === "/" || path === "/health")) {
    return sendJson(res, 200, { ok: true, ...STATE });
  }

  // Simple human page (optional)
  if (method === "GET" && path === "/hello") {
    return sendText(res, 200, "Hello World");
  }

  // API: status
  if (method === "GET" && path === "/api/status") {
    return sendJson(res, 200, {
      ok: true,
      service: STATE.app,
      bossmind: STATE.bossmind,
      version: STATE.version,
      uptimeSeconds: Math.floor((Date.now() - new Date(STATE.startedAt).getTime()) / 1000),
      ticks: STATE.tickCount,
      lastTickAt: STATE.lastTickAt,
      lastError: STATE.lastError,
      jobs: {
        total: JOBS.size,
        latest: listJobs(10),
      },
    });
  }

  // API: list jobs
  if (method === "GET" && path === "/api/jobs") {
    const limit = parsed.query && parsed.query.limit ? Number(parsed.query.limit) : 50;
    return sendJson(res, 200, { ok: true, jobs: listJobs(limit) });
  }

  // API: job by id
  if (method === "GET" && path.startsWith("/api/jobs/")) {
    const id = path.split("/").pop();
    const job = JOBS.get(String(id || ""));
    if (!job) return sendJson(res, 404, { ok: false, error: "JOB_NOT_FOUND" });
    return sendJson(res, 200, { ok: true, job });
  }

  // API: create generate-video job (stub)
  if (method === "POST" && path === "/api/generate-video") {
    try {
      const body = await readJsonBody(req);
      const prompt = body && body.prompt ? String(body.prompt) : "";
      const meta = body && body.meta ? body.meta : {};

      if (!prompt || prompt.trim().length < 3) {
        return sendJson(res, 400, { ok: false, error: "PROMPT_REQUIRED" });
      }

      const job = newJob({ prompt, meta });
      return sendJson(res, 201, { ok: true, job, next: "Poll /api/jobs/:id" });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message || "BAD_REQUEST" });
    }
  }

  // fallback
  return sendJson(res, 404, { ok: false, error: "NOT_FOUND", path, method });
});

/* ===============================
   Start
================================ */
server.listen(PORT, HOST, () => {
  console.log(`✅ Server listening on ${HOST}:${PORT}`);
});

// Automation loop (every 6 seconds, matches your ticks)
const TICK_MS = Number(process.env.BOSSMIND_TICK_MS || 6000);
setInterval(runAutomationTick, TICK_MS);

// Graceful shutdown (Railway sends SIGTERM)
function shutdown(signal) {
  console.log(`🟠 Received ${signal}, shutting down...`);
  server.close(() => {
    console.log("✅ HTTP server closed.");
    process.exit(0);
  });
  // force exit if stuck
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
