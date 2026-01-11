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
   STATIC HERO PAGE
---------------------------------------------------- */

app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* ----------------------------------------------------
   HEALTH
---------------------------------------------------- */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker",
    hero: true,
    time: new Date().toISOString()
  });
});

/* ----------------------------------------------------
   STATUS
---------------------------------------------------- */

app.get("/status", (req, res) => {
  res.json({
    bossmind: "AI Video Maker",
    state: "READY",
    port: PORT
  });
});

/* ----------------------------------------------------
   START SERVER
---------------------------------------------------- */

app.listen(PORT, () => {
  console.log("BossMind AI Video Maker LIVE on port", PORT);
});
