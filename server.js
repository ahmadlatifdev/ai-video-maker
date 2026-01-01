/**
 * ai-video-maker minimal backend
 * - Serves /public (automation.html, admin.html)
 * - Health check: GET /health
 * - Google Sheet queue: GET /api/sheet/queue?sheetUrl=...
 * - Render request: POST /api/video/render  (returns queued job + preview_url)
 *
 * NOTE:
 * To read a Google Sheet without OAuth, the sheet (or at least the target tab)
 * must be accessible via CSV export URL. Easiest: publish sheet or set sharing to "Anyone with the link (Viewer)".
 */

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "2mb" }));

// ---------- Static UI ----------
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// ---------- Helpers ----------
function safeStr(v) {
  return (v == null ? "" : String(v)).trim();
}

function parseGoogleSheetId(url) {
  // https://docs.google.com/spreadsheets/d/<ID>/edit#gid=<GID>
  const m = safeStr(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function parseGoogleSheetGid(url) {
  const m = safeStr(url).match(/[?#&]gid=(\d+)/);
  return m ? m[1] : "0";
}

// Minimal CSV parser supporting quoted values + commas inside quotes
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      // Escaped quote
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      // Ignore empty last row
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cur += ch;
  }

  // last cell
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  return rows.map((r) => r.map((c) => safeStr(c)));
}

function normalizeHeader(h) {
  return safeStr(h).toLowerCase().replace(/\s+/g, "_");
}

function detectTitleKey(headersNorm) {
  const candidates = [
    "title",
    "video_title",
    "name",
    "video",
    "video_name",
    "episode_title",
  ];
  for (const c of candidates) {
    if (headersNorm.includes(c)) return c;
  }
  return headersNorm[0] || "col_0";
}

function detectLangKey(headersNorm) {
  const candidates = ["language", "lang", "video_language"];
  for (const c of candidates) {
    if (headersNorm.includes(c)) return c;
  }
  return null;
}

function detectDurationKey(headersNorm) {
  const candidates = ["duration_minutes", "duration", "minutes", "video_minutes"];
  for (const c of candidates) {
    if (headersNorm.includes(c)) return c;
  }
  return null;
}

function detectStatusKey(headersNorm) {
  const candidates = ["status", "state"];
  for (const c of candidates) {
    if (headersNorm.includes(c)) return c;
  }
  return null;
}

function detectVideoUrlKey(headersNorm) {
  const candidates = ["video_url", "url", "link", "youtube_link", "video_link"];
  for (const c of candidates) {
    if (headersNorm.includes(c)) return c;
  }
  return null;
}

// In-memory job store (minimal)
const JOBS = new Map();

function newJob(payload) {
  const id = `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
  const job = {
    id,
    status: "queued",
    created_at: new Date().toISOString(),
    payload,
    preview_url: payload?.preview_url || null,
  };
  JOBS.set(id, job);
  return job;
}

// ---------- Routes ----------
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker-minimal-backend",
    time: new Date().toISOString(),
    jobs: JOBS.size,
  });
});

/**
 * Read queue from a Google Sheet tab via CSV export.
 * GET /api/sheet/queue?sheetUrl=<full google sheet url>
 */
app.get("/api/sheet/queue", async (req, res) => {
  try {
    const sheetUrl = safeStr(req.query.sheetUrl);
    if (!sheetUrl) {
      return res.status(400).json({ ok: false, error: "Missing sheetUrl" });
    }

    const id = parseGoogleSheetId(sheetUrl);
    const gid = parseGoogleSheetGid(sheetUrl);
    if (!id) {
      return res.status(400).json({ ok: false, error: "Could not parse sheet ID from sheetUrl" });
    }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;

    const r = await fetch(csvUrl, { method: "GET" });
    if (!r.ok) {
      return res.status(502).json({
        ok: false,
        error: `Google returned ${r.status}. Make sure the sheet tab is accessible (Viewer/public) or published.`,
        csvUrl,
      });
    }

    const text = await r.text();
    const rows = parseCsv(text);
    if (!rows.length) return res.json({ ok: true, count: 0, items: [] });

    const headers = rows[0];
    const headersNorm = headers.map(normalizeHeader);
    const titleKey = detectTitleKey(headersNorm);
    const langKey = detectLangKey(headersNorm);
    const durationKey = detectDurationKey(headersNorm);
    const statusKey = detectStatusKey(headersNorm);
    const videoUrlKey = detectVideoUrlKey(headersNorm);

    const items = rows.slice(1).map((cols, idx) => {
      const obj = {};
      for (let i = 0; i < headersNorm.length; i++) {
        obj[headersNorm[i] || `col_${i}`] = safeStr(cols[i] ?? "");
      }

      const title = obj[titleKey] || `Row ${idx + 2}`;
      const language = langKey ? (obj[langKey] || "auto") : "auto";
      const duration_minutes = durationKey ? Number(obj[durationKey] || 0) || null : null;
      const status = statusKey ? (obj[statusKey] || "") : "";
      const video_url = videoUrlKey ? (obj[videoUrlKey] || "") : "";

      return {
        row_index: idx + 2, // Google sheet row number (1-based header row)
        title,
        language,
        duration_minutes,
        status,
        video_url,
        raw: obj,
      };
    });

    res.json({
      ok: true,
      csvUrl,
      count: items.length,
      headers: headersNorm,
      items,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "Unknown error" });
  }
});

/**
 * Render request (minimal):
 * POST /api/video/render
 * body: { title, language, duration_minutes, source, preview_url }
 */
app.post("/api/video/render", (req, res) => {
  const title = safeStr(req.body?.title) || "Untitled";
  const language = safeStr(req.body?.language) || "auto";
  const duration_minutes = Number(req.body?.duration_minutes || 0) || null;
  const source = safeStr(req.body?.source) || "manual";
  const preview_url = safeStr(req.body?.preview_url) || "";

  // IMPORTANT: This does NOT generate a real video yet.
  // It queues a job and returns a preview URL if your sheet provides one.
  const job = newJob({
    title,
    language,
    duration_minutes,
    source,
    preview_url: preview_url || null,
  });

  res.json({
    ok: true,
    id: job.id,
    status: job.status,
    preview_url: job.preview_url || null,
    note: "Queued (minimal backend). Real render engine (Luma/Runway/voice) will be wired next.",
  });
});

/**
 * List jobs (optional)
 * GET /api/jobs
 */
app.get("/api/jobs", (req, res) => {
  const items = Array.from(JOBS.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.json({ ok: true, count: items.length, items });
});

// Fallback to automation.html
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "automation.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[ai-video-maker] backend listening on :${PORT}`);
});
