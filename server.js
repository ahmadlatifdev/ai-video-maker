/**
 * BossMind AI Video Generator - Backend Wiring Phase
 * server.js (CommonJS – Railway Safe)
 *
 * Goal:
 * Replace BigBuckBunny placeholder with Google Sheet queue,
 * then expose language + voice wiring endpoints.
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { createClient } = require("@supabase/supabase-js");
const { google } = require("googleapis");

/* ----------------------------- App ----------------------------- */
const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

/* ----------------------------- ENV ----------------------------- */
function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required ENV: ${name}`);
  return v;
}

const PORT = Number(process.env.PORT || 8080);

const SUPABASE_URL = mustEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

const SHEET_ID = mustEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
const SHEET_NAME = mustEnv("GOOGLE_SHEETS_SHEET_NAME");
const GOOGLE_SERVICE_ACCOUNT_JSON = mustEnv("GOOGLE_SERVICE_ACCOUNT_JSON");

const DEFAULT_LANGS = (process.env.DEFAULT_LANGS || "ar,en,fr,de,es,ru,sq")
  .split(",")
  .map(v => v.trim())
  .filter(Boolean);

let DEFAULT_VOICES = {};
try {
  DEFAULT_VOICES = JSON.parse(process.env.DEFAULT_VOICES_JSON || "{}");
} catch {
  DEFAULT_VOICES = {};
}

/* ----------------------------- Supabase ----------------------------- */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/* ----------------------------- Google Sheets ----------------------------- */
function parseServiceAccount(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  }
}

const serviceAccount = parseServiceAccount(GOOGLE_SERVICE_ACCOUNT_JSON);

const jwt = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth: jwt });

async function readSheet(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values || [];
}

function normalize(h) {
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "_");
}

async function getNextQueueItem() {
  const rows = await readSheet(`${SHEET_NAME}!A1:ZZ5000`);
  if (!rows.length) return null;

  const headers = rows[0].map(normalize);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = row[idx] ?? ""));

    const status = String(obj.status || "").toLowerCase();
    const done = obj.youtube_url || obj.video_url;

    if (status && status !== "ready") continue;
    if (!status && done) continue;

    const lang = obj.language || DEFAULT_LANGS[0] || "en";
    const voice = obj.voice || (DEFAULT_VOICES[lang]?.voice || "");

    return {
      sheetRow: i + 1,
      title: obj.title || "",
      prompt: obj.prompt || "",
      language: lang,
      voice,
      raw: obj,
    };
  }
  return null;
}

/* ----------------------------- Routes ----------------------------- */
app.get("/health", (_, res) => {
  res.json({ ok: true, service: "bossmind-video-backend" });
});

app.get("/api/queue/next", async (_, res) => {
  try {
    const item = await getNextQueueItem();
    if (!item) return res.status(204).send();
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/config/languages", (_, res) => {
  res.json({ ok: true, languages: DEFAULT_LANGS });
});

app.get("/api/config/voices", (_, res) => {
  res.json({ ok: true, voices: DEFAULT_VOICES });
});

app.post("/api/logs/event", async (req, res) => {
  const { type, message, meta } = req.body || {};
  const { error } = await supabase
    .from("system_logs")
    .insert({
      type: type || "event",
      message: message || "",
      meta: meta || {},
      created_at: new Date().toISOString(),
    });

  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

/* ----------------------------- Start ----------------------------- */
app.listen(PORT, () => {
  console.log(`[BossMind] Backend LIVE on port ${PORT}`);
  console.log(`[BossMind] Queue source: Google Sheets`);
});
