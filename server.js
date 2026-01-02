/**
 * BossMind AI Video Generator - Backend Wiring Phase
 * server.js
 *
 * Goal (Phase): Replace BigBuckBunny placeholder with Google Sheet queue,
 * then expose endpoints for language + voice wiring.
 *
 * Requires ENV:
 *  - PORT
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - GOOGLE_SHEETS_SPREADSHEET_ID
 *  - GOOGLE_SHEETS_SHEET_NAME
 *  - GOOGLE_SERVICE_ACCOUNT_JSON   (the full JSON string of the service account)
 *  - DEFAULT_LANGS                 (e.g. "ar,en,fr,de,es,ru,sq")
 *  - DEFAULT_VOICES_JSON           (optional, JSON string map by language)
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

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

const PORT = Number(process.env.PORT || 5055);

const SUPABASE_URL = mustEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

const SHEET_ID = mustEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
const SHEET_NAME = mustEnv("GOOGLE_SHEETS_SHEET_NAME");
const GOOGLE_SERVICE_ACCOUNT_JSON = mustEnv("GOOGLE_SERVICE_ACCOUNT_JSON");

const DEFAULT_LANGS = (process.env.DEFAULT_LANGS || "ar,en,fr,de,es,ru,sq")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Optional: {"ar":{"voice":"ar-XA-Wavenet-A"},"en":{"voice":"en-US-Neural2-J"}}
const DEFAULT_VOICES_JSON = process.env.DEFAULT_VOICES_JSON || "{}";
let DEFAULT_VOICES = {};
try {
  DEFAULT_VOICES = JSON.parse(DEFAULT_VOICES_JSON);
} catch {
  DEFAULT_VOICES = {};
}

/* ----------------------------- Supabase ----------------------------- */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ----------------------------- Google Sheets ----------------------------- */
function parseServiceAccountJson(raw) {
  // Supports either raw JSON or base64 JSON
  try {
    return JSON.parse(raw);
  } catch {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded);
  }
}

const serviceAccount = parseServiceAccountJson(GOOGLE_SERVICE_ACCOUNT_JSON);

const jwt = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: (serviceAccount.private_key || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth: jwt });

async function readSheetValues(rangeA1) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: rangeA1,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values || [];
}

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] ?? "";
  });
  return obj;
}

/**
 * We assume:
 * - Row 1 is headers.
 * - There is a "status" column (recommended) with values: "ready" / "processing" / "done"
 * If "status" does not exist, we fall back to: first row with empty "youtube_url" (or empty "video_url").
 */
async function fetchNextQueueItemFromSheet() {
  // Read a wide range; adjust if your sheet is huge.
  const range = `${SHEET_NAME}!A1:ZZ5000`;
  const values = await readSheetValues(range);
  if (!values.length) return null;

  const rawHeaders = values[0] || [];
  const headers = rawHeaders.map(normalizeHeader);

  const statusIdx = headers.indexOf("status");
  const youtubeIdx = headers.indexOf("youtube_url");
  const videoIdx = headers.indexOf("video_url");
  const titleIdx = headers.indexOf("title");
  const promptIdx = headers.indexOf("prompt");
  const languageIdx = headers.indexOf("language");
  const voiceIdx = headers.indexOf("voice");

  for (let r = 1; r < values.length; r++) {
    const row = values[r] || [];
    const obj = rowToObject(headers, row);

    const status = statusIdx >= 0 ? String(row[statusIdx] || "").trim().toLowerCase() : "";
    const youtube = youtubeIdx >= 0 ? String(row[youtubeIdx] || "").trim() : "";
    const video = videoIdx >= 0 ? String(row[videoIdx] || "").trim() : "";

    const readyByStatus = statusIdx >= 0 ? status === "ready" : false;
    const readyByEmptyLink =
      statusIdx < 0 && ((youtubeIdx >= 0 && !youtube) || (videoIdx >= 0 && !video) || (youtubeIdx < 0 && videoIdx < 0));

    if (!readyByStatus && !readyByEmptyLink) continue;

    // Minimal fields we expose downstream:
    const title = titleIdx >= 0 ? String(row[titleIdx] || "").trim() : String(obj.title || "").trim();
    const prompt = promptIdx >= 0 ? String(row[promptIdx] || "").trim() : String(obj.prompt || "").trim();

    // Language/Voice wiring placeholders:
    const languageRaw = languageIdx >= 0 ? String(row[languageIdx] || "").trim() : String(obj.language || "").trim();
    const language = languageRaw || DEFAULT_LANGS[0] || "en";

    const voiceRaw = voiceIdx >= 0 ? String(row[voiceIdx] || "").trim() : String(obj.voice || "").trim();
    const voice = voiceRaw || (DEFAULT_VOICES[language]?.voice || "");

    return {
      sheet: { rowIndex1Based: r + 1 }, // actual sheet row number (1-based)
      title,
      prompt,
      language,
      voice,
      raw: obj,
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
 * Returns next queue item from Google Sheet (replaces BigBuckBunny placeholder).
 */
app.get("/api/queue/next", async (req, res) => {
  try {
    const item = await fetchNextQueueItemFromSheet();
    if (!item) return res.status(204).send(); // no content
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/**
 * GET /api/config/languages
 * Used by frontend for the language selector default set.
 */
app.get("/api/config/languages", (req, res) => {
  res.json({ ok: true, languages: DEFAULT_LANGS });
});

/**
 * GET /api/config/voices
 * Used by frontend to show voice per language (basic wiring).
 */
app.get("/api/config/voices", (req, res) => {
  res.json({ ok: true, voices: DEFAULT_VOICES });
});

/**
 * POST /api/logs/event
 * Store operational events in Supabase (optional but recommended).
 * body: { type, message, meta }
 */
app.post("/api/logs/event", async (req, res) => {
  try {
    const { type, message, meta } = req.body || {};
    const payload = {
      type: String(type || "event"),
      message: String(message || ""),
      meta: meta ?? {},
      created_at: new Date().toISOString(),
    };

    // Table name: "system_logs" (change if yours differs)
    const { error } = await supabase.from("system_logs").insert(payload);
    if (error) return res.status(500).json({ ok: false, error: error.message });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/* ----------------------------- Start ----------------------------- */
app.listen(PORT, () => {
  // This is the explicit proof we are NOT using BigBuckBunny:
  console.log(`[BossMind] server.js running on :${PORT}`);
  console.log(`[BossMind] Queue source: Google Sheets -> ${SHEET_ID} / ${SHEET_NAME}`);
});
