// automation.js — COMPLETE & FINAL (Static + API)

const express = require("express");
const path = require("path");

const app = express();

// Railway dynamic port
const PORT = process.env.PORT || 8080;

// ✅ SERVE STATIC FILES
app.use(express.static(path.join(__dirname, "public")));

// Root
app.get("/", (req, res) => {
  res.send("BossMind AI Video Maker — ACTIVE");
});

// Health
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "BossMind Core API",
    timestamp: new Date().toISOString(),
  });
});

// Keep alive
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BossMind Web Server running on port ${PORT}`);
});
