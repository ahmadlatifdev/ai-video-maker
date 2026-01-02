/**
 * BossMind AI Video Generator – Backend
 * Phase: Google Sheet Queue + Language → Voice → OpenAI TTS
 *
 * CommonJS build (Railway-safe without "type":"module")
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

// OpenAI SDK (supports CJS, but handle both default/non-default exports safely)
const OpenAIImport = require("openai");
const OpenAI = OpenAIImport.default || OpenAIImport;

/* =======================
   ENV VALIDATION
======================= */
function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required ENV: ${name}`);
  return v;
}

const PORT = process.env.PORT || 8080;

const GOOGLE_SHEETS_SPREADSHEET_ID = mustEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
const GOOGLE_SHEETS_SHEET_NAME = mustEnv("GOOGLE_SHEETS_SHEET_NAME");
const OPENAI_API_KEY = mustEnv("OPENAI_API_KEY");

/* =======================
   APP SETUP
======================= */
const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/* =======================
   LANGUAGE → VOICE MAP
   (extend later safely)
======================= */
const VOICE_MAP = {
  en: "alloy",
  ar: "alloy",
  fr: "alloy",
  de: "alloy",
  es: "alloy",
  ru: "alloy",
  sq: "alloy", // Albanian
};

/* =======================
   GOOGLE SHEET (GViz)
======================= */
function gvizUrl() {
  const sheet = encodeURIComponent(GOOGLE_SHEETS_SHEET_NAME);
  return `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheet}`;
}

async function fetchQueue() {
  // Node 18+ has global fetch (Railway uses Node 18 in your logs)
  const res = await fetch(gvizUrl());
  if (!res.ok) throw new Error(`Failed to fetch Google Sheet (HTTP ${res.status})`);

  const text = await res.text();

  // GViz wraps JSON like: google.visualization.Query.setResponse(<json>);
  const json = JSON.parse(text.substring(47, text.length - 2));

  const cols = json.table.cols.map((c) => (c.label || "").trim());
  const rows = json.table.rows.map((r) => {
    const obj = {};
    (r.c || []).forEach((cell, i) => {
      const key = cols[i] || `col_${i}`;
      obj[key] = cell?.v ?? "";
    });
    return obj;
  });

  return rows;
}

/* =======================
   TTS GENERATION
======================= */
async function generateSpeech({ text, language }) {
  const voice = VOICE_MAP[language] || VOICE_MAP.en;

  const audio = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice,
    input: text,
    format: "mp3",
  });

  const buf = Buffer.from(await audio.arrayBuffer());
  return buf;
}

/* =======================
   ROUTES
======================= */
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "BossMind AI Video Generator",
    queue: "google_sheet_gviz",
  });
});

app.get("/queue", async (_req, res) => {
  try {
    const queue = await fetchQueue();
    res.json(queue);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/tts", async (req, res) => {
  try {
    const { text, language = "en" } = req.body || {};
    if (!text) return res.status(400).json({ error: "text is required" });

    const audio = await generateSpeech({ text, language });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(audio.length));
    res.send(audio);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

/* =======================
   START
======================= */
app.listen(PORT, () => {
  console.log(`[BossMind] Backend LIVE on port ${PORT}`);
  console.log(`[BossMind] Queue source: PUBLISHED Google Sheet (GViz)`);
  console.log(
    `[BossMind] Sheet: ${GOOGLE_SHEETS_SPREADSHEET_ID} / ${GOOGLE_SHEETS_SHEET_NAME}`
  );
  console.log(`[BossMind] TTS: OpenAI (gpt-4o-mini-tts)`);
});
