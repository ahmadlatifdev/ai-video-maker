// automation.js — COMPLETE (Static + API + /admin)

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));

// ✅ Clean admin route: /admin -> admin.html
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

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
