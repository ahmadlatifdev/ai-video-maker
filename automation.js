/**
 * automation.js (CommonJS) - Railway safe
 * Node 18+ has global fetch, so NO node-fetch needed.
 */

const express = require("express");

const app = express();

// Basic settings
app.disable("x-powered-by");

// ---- ENV ----
const PORT = parseInt(process.env.PORT || "8080", 10);
const STABILITY_API_KEY = process.env.STABILITY_API_KEY || "";

// ---- ROUTES ----
app.get("/", (_req, res) => {
  res
    .status(200)
    .type("html")
    .send("<h1>Hello World</h1>");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    status: "healthy",
    hasStabilityKey: Boolean(STABILITY_API_KEY),
    engine: "stable-diffusion-xl-1024-v1-0",
    port: PORT,
  });
});

/**
 * Example ping route that uses built-in fetch (optional)
 * You can delete if you don't need it.
 */
app.get("/ping", async (_req, res) => {
  try {
    const r = await fetch("https://example.com", { method: "GET" });
    res.status(200).json({ ok: true, upstreamStatus: r.status });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ---- START ----
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BossMind Core API listening on http://0.0.0.0:${PORT}`);
});

// ---- GRACEFUL SHUTDOWN ----
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    console.log("Force exit.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
