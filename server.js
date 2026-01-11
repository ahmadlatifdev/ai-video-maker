/**
 * BossMind – AI Video Maker
 * Hero Page + API Server
 * Google Sheet Queue (NO AUTH)
 */

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

/* ===============================
   YOUR REAL GOOGLE SHEET (gviz JSON)
================================ */
const GOOGLE_SHEET_GVIZ_URL =
  "https://docs.google.com/spreadsheets/d/1WNcSaCKZBhvRxfjtgvSI4DimKA_SGCzUj7ETU3jnB4M/gviz/tq?tqx=out:json";

/* ===============================
   STATIC
================================ */
app.use(express.static(PUBLIC_DIR));
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

/* ===============================
   HEALTH
================================ */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker",
    hero: true,
    time: new Date().toISOString(),
  });
});

/* ===============================
   HELPERS
================================ */
function parseGviz(text) {
  // gviz response looks like: "/*O_o*/\ngoogle.visualization.Query.setResponse({...});"
  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(jsonText);
}

async function fetchText(url) {
  const r = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": "BossMind/1.0" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

/* ===============================
   QUEUE ENDPOINT (what UI calls)
================================ */
app.get("/api/sheet/queue", async (req, res) => {
  try {
    const txt = await fetchText(GOOGLE_SHEET_GVIZ_URL);
    const json = parseGviz(txt);

    const rows = (json?.table?.rows || []).map((r) => {
      const c = r.c || [];
      return {
        title: c[0]?.v || "",
        moral: c[1]?.v || "",
        theme: c[2]?.v || "",
        script: c[3]?.v || "",
        status: c[4]?.v || "",
        reviewed: c[5]?.v || "",
      };
    });

    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===============================
   OPTIONAL ADMIN STATUS (for snapshot)
================================ */
app.get("/api/admin/status/video", async (req, res) => {
  try {
    const txt = await fetchText(GOOGLE_SHEET_GVIZ_URL);
    const json = parseGviz(txt);

    const rows = json?.table?.rows || [];
    const mapped = rows.map((r) => r.c || []);
    const statuses = mapped.map((c) => c[4]?.v || "");

    const queueLength = statuses.filter((s) => s && s !== "COMPLETED").length;

    const lastCompleted = mapped
      .slice()
      .reverse()
      .find((c) => (c[4]?.v || "") === "COMPLETED");

    res.json({
      ok: true,
      queueLength,
      lastPublish: lastCompleted?.[0]?.v || null,
      errors24h: 0,
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
