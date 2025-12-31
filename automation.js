// automation.js — COMPLETE & FINAL

import express from "express";

const app = express();

// Railway-required dynamic port
const PORT = process.env.PORT || 8080;

// Health check (Railway + BossMind)
app.get("/", (req, res) => {
  res.status(200).send("BossMind AI Video Maker — ACTIVE");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "BossMind Core API",
    timestamp: new Date().toISOString()
  });
});

// KEEP PROCESS ALIVE
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BossMind Web Server running on port ${PORT}`);
});
