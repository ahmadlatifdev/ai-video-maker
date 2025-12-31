/**
 * BossMind – Automation Core
 * Stable Railway + Cloudflare compatible
 */

import express from "express";
import process from "process";

const app = express();

/* ===============================
   CONFIG
================================ */
const PORT = process.env.PORT || 8080;

/* ===============================
   MIDDLEWARE
================================ */
app.use(express.json());

/* ===============================
   ROUTES
================================ */

// Root – Cloudflare expects this to respond fast
app.get("/", (req, res) => {
  res.status(200).send("BossMind API is running");
});

// Health check (used by Actions + monitoring)
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    status: "healthy",
    hasStabilityKey: Boolean(process.env.STABILITY_API_KEY),
    engine: "stable-diffusion-xl-1024-v1-0",
    timestamp: new Date().toISOString(),
  });
});

/* ===============================
   ERROR HANDLING (NO CRASH)
================================ */
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

/* ===============================
   START SERVER
================================ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BossMind Core API listening on http://0.0.0.0:${PORT}`);
});
