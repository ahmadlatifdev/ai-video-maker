/**
 * BossMind AI Video Generator – Backend Wiring Phase (FINAL for Published Sheet)
 * server.js (CommonJS, Railway-safe, NO Google Auth)
 *
 * Queue source: Google Sheets "Publish to web" (machine-readable)
 *
 * Required ENV:
 *  - PORT (optional)
 *  - GOOGLE_SHEETS_SPREADSHEET_ID
 *  - GOOGLE_SHEETS_SHEET_NAME
 * Optional ENV:
 *  - DEFAULT_LANGS (e.g. "ar,en,fr,de,es,ru,sq")
 *  - DEFAULT_VOICES_JSON (e.g. {"ar":{"voice":"ar-voice-1"},"en":{"voice":"en-voice-1"}})
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

/* ----------------------------- App ----------------------------- */
const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

/* ----------------------------- ENV helpers ----------------------------- */
function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required ENV: ${name}`);
  return v;
}

const PORT = Number(process.env.PORT || 8080);

const SHEET_ID = mustEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
const SHEET_NAME = mustEnv("GOOGLE_SHEETS_SHEET_NAME");

const DEFAULT_LANGS = (process.env.DEFAULT_LANGS || "ar,en,fr,de,es,ru,sq")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

let DEFAULT_VOICES = {};
try {
  DEFAULT_VOICES = JSON.parse(process.env.DEFAULT_VOICES_JSON || "{}");
} catch {
  DEFAULT_VOICES = {};
}

/* ----------------------------- Fetch (no extra deps) ----------------------------- */
async function fetchText(url) {
  // Node 18+ has fetch globally. If not, fail clearly.
  if (typeof fetch !== "function") {
    throw new Error("Global fetch not available. Use Node 18+ runtime.");
  }
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${await res.text()}`);
  return await res.text();
}

/* ----------------------------- Sheet reader (Published-to-web / gviz) ----------------------------- */
function gvizUrl(sheetId, sheetName) {
  // This works when sheet is "Published to web"
  return (
    `https://docs.google.com/spreadsheets/d/${sheetId}` +
    `/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`
  );
}

function parseGviz(text) {
  // Google returns: google.visualization.Query.setResponse(<json>);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Unexpected GViz response.");
  const jsonStr = text.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function toCellValue(cell) {
  // cell can be null, or {v:...}
  if (!cell) return "";
  if (typeof cell.v === "undefined" || cell.v === null) return "";
  return cell.v;
}

/**
 * Expected columns (recommended):
 *  - status : "ready" | "processing" | "done"
 *  - title
 *  - prompt
 *  - language (optional)
 *  - voice (optional)
 *  - youtube_url OR video_url (optional)
 *
 * Selection rules:
 *  - If status exists: pick first row where status == "ready"
 *  - Else: pick first row where youtube_url/video_url is empty
 */
async function fetchNextQueueItemFromPublishedSheet() {
  const url = gvizUrl(SHEET_ID, SHEET_NAME);
  const raw = await fetchText(url);
  const data = parseGviz(raw);

  const table = data.table;
  if (!table || !table.cols || !table.rows) return null;

  const headers = table.cols.map((c) => normalizeHeader(c.label));
  const rows = table.rows;

  const statusIdx = headers.indexOf("status");
  const titleIdx = headers.indexOf("title");
  const promptIdx = headers.indexOf("prompt");
  const languageIdx = headers.indexOf("language");
  const voiceIdx = headers.indexOf("voice");
  const youtubeIdx = headers.indexOf("youtube_url");
  const videoIdx = headers.indexOf("video_url");

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].c || [];
    const get = (idx) => (idx >= 0 ? toCellValue(cells[idx]) : "");

    const status = String(get(statusIdx)).trim().toLowerCase();
    const youtube = String(get(youtubeIdx)).trim();
    const video = String(get(videoIdx)).trim();

    const readyByStatus = statusIdx >= 0 ? status === "ready" : false;
    const readyByNoLinks =
      statusIdx < 0 &&
      ((youtubeIdx >= 0 && !youtube) || (videoIdx >= 0 && !video) || (youtubeIdx < 0 && videoIdx < 0));

    if (!readyByStatus && !readyByNoLinks) continue;

    const title = String(get(titleIdx)).trim();
    const prompt = String(get(promptIdx)).trim();

    const langRaw = String(get(languageIdx)).trim();
    const language = langRaw || DEFAULT_LANGS[0] || "en";

    const voiceRaw = String(get(voiceIdx)).trim();
    const voice = voiceRaw || (DEFAULT_VOICES[language]?.voice || "");

    // Build raw object for debugging/preview
    const rawObj = {};
    for (let i = 0; i < headers.length; i++) rawObj[headers[i]] = toCellValue(cells[i]);

    return {
      sheet: { rowIndex0Based: r, rowIndex1BasedApprox: r + 2 }, // header row + 1
      title,
      prompt,
      language,
      voice,
      raw: rawObj,
      source: "published_sheet_gviz",
    };
  }

  return null;
}

/* ----------------------------- Routes ----------------------------- */
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "bossmind-video-backend", time: new Date().toISOString() });
});

/**
 * GET /api/queue/next
 * Returns next queue item from Google Sheet (Published-to-web).
 */
app.get("/api/queue/next", async (req, res) => {
  try {
    const item = await fetchNextQueueItemFromPublishedSheet();
    if (!item) return res.status(204).send();
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/**
 * GET /api/config/languages
 */
app.get("/api/config/languages", (req, res) => {
  res.json({ ok: true, languages: DEFAULT_LANGS });
});

/**
 * GET /api/config/voices
 */
app.get("/api/config/voices", (req, res) => {
  res.json({ ok: true, voices: DEFAULT_VOICES });
});

/* ----------------------------- Start ----------------------------- */
app.listen(PORT, () => {
  console.log(`[BossMind] Backend LIVE on port ${PORT}`);
  console.log(`[BossMind] Queue source: PUBLISHED Google Sheet (GViz)`);
  console.log(`[BossMind] Sheet: ${SHEET_ID} / ${SHEET_NAME}`);
});
