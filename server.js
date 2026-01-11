/**
 * BossMind – AI Video Maker
 * Hero Page + API Server
 * Google Sheet Queue (NO AUTH)
 */

const express = require("express");
const path = require("path");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

/* ===============================
   YOUR REAL GOOGLE SHEET
================================ */
const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1WNcSaCKZBhvRxfjtgvSI4DimKA_SGCzUj7ETU3jnB4M/gviz/tq?tqx=out:json";

/* ===============================
   STATIC
================================ */
app.use(express.static(PUBLIC_DIR));
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* ===============================
   HEALTH
================================ */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker",
    hero: true,
    time: new Date().toISOString()
  });
});

/* ===============================
   LOAD QUEUE FROM GOOGLE SHEET
================================ */
app.get("/api/sheet/queue", async (req, res) => {
  try {
    const r = await fetch(GOOGLE_SHEET_URL);
    const txt = await r.text();

    const json = JSON.parse(txt.substring(47).slice(0, -2));
    const rows = json.table.rows.map(r => {
      const c = r.c;
      return {
        title: c[0]?.v || "",
        moral: c[1]?.v || "",
        theme: c[2]?.v || "",
        script: c[3]?.v || "",
        status: c[4]?.v || ""
      };
    });

    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===============================
   ADMIN STATUS
================================ */
app.get("/api/admin/status/video", async (req, res) => {
  try {
    const r = await fetch(GOOGLE_SHEET_URL);
    const txt = await r.text();
    const json = JSON.parse(txt.substring(47).slice(0, -2));

    const rows = json.table.rows;
    const queue = rows.filter(r => r.c[4]?.v !== "COMPLETED").length;
    const last = rows.reverse().find(r => r.c[4]?.v === "COMPLETED");

    res.json({
      ok: true,
      queueLength: queue,
      lastPublish: last?.c[0]?.v || null
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

/* ===============================
   START
================================ */
app.listen(PORT, () => {
  console.log("BossMind AI Video Maker LIVE on port", PORT);
});
