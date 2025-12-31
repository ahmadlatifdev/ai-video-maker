// automation.js — COMPLETE (CommonJS, Railway-safe)

const express = require("express");

const app = express();

// Railway-required dynamic port
const PORT = process.env.PORT || 8080;

// Root page
app.get("/", (req, res) => {
  res.status(200).send("BossMind AI Video Maker — ACTIVE");
});

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "BossMind Core API",
    timestamp: new Date().toISOString(),
  });
});

// KEEP PROCESS ALIVE
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BossMind Web Server running on port ${PORT}`);
});
