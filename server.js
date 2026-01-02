/**
 * BossMind AI Video Generator – Backend
 * Phase: Google Sheet Queue + Language → Voice → OpenAI TTS
 *
 * CommonJS build (Railway-safe without "type":"module")
 *
 * FIX: Use GOOGLE_SHEETS_PUBLISHED_URL (pubhtml) because GViz can return 410.
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

// New (preferred) source: Published-to-web URL (pubhtml)
const GOOGLE_SHEETS_PUBLISHED_URL = mustEnv("GOOGLE_SHEETS_PUBLISHED_URL");

// Still keep these for logging / future switch-back
const GOOGLE_SHEETS_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "";
const GOOGLE_SHEETS_SHEET_NAME = process.env.GOOGLE_SHEETS_SHEET_NAME || "";

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
======================= */
const VOICE_MAP = {
  en: "alloy",
  ar: "alloy",
  fr: "alloy",
  de: "alloy",
  es: "alloy",
  ru: "alloy",
  sq: "alloy" // Albanian
};

/* =======================
   PUBLISHED GOOGLE SHEET PARSER (pubhtml)
   We read the HTML and extract the first HTML table.
   This is reliable for public read-only queues.
======================= */
function stripTags(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeKey(k) {
  return String(k || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "")
    .toLowerCase();
}

function parseFirstHtmlTable(html) {
  // Find the first <table ...> ... </table>
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return { headers: [], rows: [] };

  const tableHtml = tableMatch[0];

  // Extract rows
  const trMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const allRows = trMatches.map((tr) => {
    const cellMatches = tr.match(/<(td|th)[\s\S]*?<\/(td|th)>/gi) || [];
    return cellMatches.map((cell) => stripTags(cell).trim());
  });

  if (allRows.length === 0) return { headers: [], rows: [] };

  // First row = headers
  const rawHeaders = allRows[0];
  const headers = rawHeaders.map((h, i) => normalizeKey(h) || `col_${i}`);

  // Remaining rows = data
  const rows = allRows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? "";
    });
    return obj;
  });

  return { headers, rows };
}

async function fetchQueueFromPublishedUrl() {
  const res = await fetch(GOOGLE_SHEETS_PUBLISHED_URL, {
    headers: { "user-agent": "BossMind/1.0 (+railway)" }
  });
  if (!res.ok) throw new Error(`Failed to fetch Published Google Sheet (HTTP ${res.status})`);

  const html = await res.text();
  const { rows } = parseFirstHtmlTable(html);

  // Filter totally empty rows
  const filtered = rows.filter((r) => Object.values(r).some((v) => String(v).trim() !== ""));
  return filtered;
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
    format: "mp3"
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
    queue: "google_sheet_published_url_pubhtml"
  });
});

app.get("/queue", async (_req, res) => {
  try {
    const queue = await fetchQueueFromPublishedUrl();
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
  console.log(`[BossMind] Queue source: PUBLISHED Google Sheet (pubhtml)`);
  console.log(`[BossMind] Published URL: ${GOOGLE_SHEETS_PUBLISHED_URL}`);

  if (GOOGLE_SHEETS_SPREADSHEET_ID || GOOGLE_SHEETS_SHEET_NAME) {
    console.log(
      `[BossMind] (info) Sheet: ${GOOGLE_SHEETS_SPREADSHEET_ID} / ${GOOGLE_SHEETS_SHEET_NAME}`
    );
  }

  console.log(`[BossMind] TTS: OpenAI (gpt-4o-mini-tts)`);
});
