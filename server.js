/**
 * BossMind – AI Video Maker
 * Hero Page + API Server + Sheet Queue (NO-KEYS MODE)
 */

const express = require("express");
const path = require("path");

const app = express();

/* ----------------------------------------------------
   CONFIG
---------------------------------------------------- */

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

// ✅ NO-KEYS Sheet mode (public sheet)
const SHEET_URL_ENV = process.env.GOOGLE_SHEET_URL || "";
const SHEET_NAME_ENV = process.env.GOOGLE_SHEET_NAME || ""; // optional
const STATUS_COL_NAME = (process.env.SHEET_STATUS_COL || "Status").trim(); // header name
const READY_VALUE = (process.env.SHEET_READY_VALUE || "READY").trim();

/* ----------------------------------------------------
   MIDDLEWARE
---------------------------------------------------- */

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

/* ----------------------------------------------------
   HERO
---------------------------------------------------- */

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* ----------------------------------------------------
   HEALTH (public + admin alias)
---------------------------------------------------- */

function healthPayload() {
  return {
    ok: true,
    service: "ai-video-maker",
    hero: true,
    time: new Date().toISOString()
  };
}

app.get("/health", (req, res) => res.json(healthPayload()));
app.get("/api/admin/health", (req, res) => res.json(healthPayload()));

/* ----------------------------------------------------
   STATUS (public)
---------------------------------------------------- */

app.get("/status", (req, res) => {
  res.json({
    bossmind: "AI Video Maker",
    state: "READY",
    port: Number(PORT),
    time: new Date().toISOString()
  });
});

/* ----------------------------------------------------
   ADMIN JOBS + STATUS (what the Admin UI expects)
---------------------------------------------------- */

const JOBS = [];
const MAX_JOBS = 50;

function pushJob(job) {
  JOBS.unshift(job);
  if (JOBS.length > MAX_JOBS) JOBS.length = MAX_JOBS;
}

app.post("/api/admin/jobs", (req, res) => {
  const job = (req.body?.job || "").toString().trim();
  const scope = (req.body?.scope || "video").toString().trim();

  if (!job) {
    return res.status(400).json({ ok: false, error: "Missing 'job' in body" });
  }

  const record = {
    id: `job_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    job,
    scope,
    status: "QUEUED",
    receivedAt: new Date().toISOString()
  };

  pushJob(record);

  return res.json({
    ok: true,
    accepted: true,
    queued: true,
    record
  });
});

app.get("/api/admin/jobs", (req, res) => {
  res.json({ ok: true, items: JOBS });
});

app.get("/api/admin/status/video", (req, res) => {
  res.json({
    ok: true,
    scope: "video",
    state: "LIVE",
    pendingJobs: JOBS.filter((j) => j.scope === "video" && j.status === "QUEUED").length,
    lastJob: JOBS.find((j) => j.scope === "video") || null,
    time: new Date().toISOString()
  });
});

app.get("/api/admin/status/builder", (req, res) => {
  res.json({
    ok: true,
    scope: "builder",
    state: "STANDBY",
    note: "Builder status is handled by the Builder project service.",
    time: new Date().toISOString()
  });
});

app.get("/api/admin/status/system", (req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker",
    state: "LIVE",
    port: Number(PORT),
    uptimeSec: Math.floor(process.uptime()),
    jobsStored: JOBS.length,
    sheetUrlSet: Boolean(getSheetUrl()),
    time: new Date().toISOString()
  });
});

/* ----------------------------------------------------
   SHEET QUEUE (NO-KEYS MODE)
   UI expects: GET /api/sheet/queue
---------------------------------------------------- */

// in-memory override (optional)
let SHEET_URL_MEM = "";
let SHEET_NAME_MEM = "";

function getSheetUrl() {
  return (SHEET_URL_MEM || SHEET_URL_ENV || "").trim();
}
function getSheetName() {
  return (SHEET_NAME_MEM || SHEET_NAME_ENV || "").trim();
}

// Optional: allow UI/ops to set sheet URL without redeploy (NOT persisted after restart)
app.post("/api/config/sheet", (req, res) => {
  const url = (req.body?.url || "").toString().trim();
  const name = (req.body?.sheetName || "").toString().trim();

  if (!url) return res.status(400).json({ ok: false, error: "Missing 'url' in body" });

  SHEET_URL_MEM = url;
  SHEET_NAME_MEM = name;

  return res.json({ ok: true, saved: true, url: SHEET_URL_MEM, sheetName: SHEET_NAME_MEM });
});

// ---- helpers

function extractSheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : "";
}

function extractGid(url) {
  const m = url.match(/[?&]gid=([0-9]+)/);
  return m ? m[1] : "";
}

function buildCsvUrl(sheetUrl) {
  const id = extractSheetId(sheetUrl);
  if (!id) return "";

  const sheetName = encodeURIComponent(getSheetName());
  const gid = extractGid(sheetUrl);

  // Prefer sheet name if provided (works when sheet is shared/published)
  if (sheetName) {
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
  }

  // Else try gid if present
  if (gid) {
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  }

  // Fallback: first sheet via gviz (no sheet parameter sometimes defaults to first)
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
}

// Minimal CSV parser (handles quoted commas)
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === '"') {
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && c === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (!inQuotes && (c === "\n" || c === "\r")) {
      // handle CRLF
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }

    cur += c;
  }

  // last cell
  row.push(cur);
  if (row.length > 1 || row[0] !== "") rows.push(row);

  return rows;
}

function normalizeHeader(h) {
  return (h || "").toString().trim().toLowerCase();
}

function rowToObject(headers, values) {
  const o = {};
  for (let i = 0; i < headers.length; i++) {
    o[headers[i]] = (values[i] ?? "").toString();
  }
  return o;
}

app.get("/api/sheet/queue", async (req, res) => {
  try {
    const sheetUrl = getSheetUrl();
    if (!sheetUrl) {
      return res.status(400).json({
        ok: false,
        error: "GOOGLE_SHEET_URL not set",
        fix: "Set Railway variable GOOGLE_SHEET_URL (or POST /api/config/sheet with {url})"
      });
    }

    const csvUrl = buildCsvUrl(sheetUrl);
    if (!csvUrl) {
      return res.status(400).json({ ok: false, error: "Invalid Google Sheet URL" });
    }

    const r = await fetch(csvUrl, {
      method: "GET",
      headers: { "user-agent": "BossMind-AI-Video-Maker/1.0" }
    });

    const csvText = await r.text();

    // Google returns an HTML error page when not shared/published
    if (!r.ok || /<html/i.test(csvText)) {
      return res.status(400).json({
        ok: false,
        error: "Sheet not accessible (must be shared or published)",
        hint: "Set sharing to 'Anyone with the link (Viewer)' or publish sheet/tab",
        httpStatus: r.status
      });
    }

    const rows = parseCsv(csvText);
    if (!rows.length) return res.json({ ok: true, items: [], loaded: 0 });

    const headersRaw = rows[0];
    const headers = headersRaw.map((h) => h.toString().trim());
    const headersNorm = headers.map(normalizeHeader);

    const idxTitle = headersNorm.indexOf("title");
    const idxMoral = headersNorm.indexOf("moral");
    const idxTheme = headersNorm.indexOf("theme");

    const idxStatus = headersNorm.indexOf(normalizeHeader(STATUS_COL_NAME));

    const items = [];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const obj = rowToObject(headers, values);

      const status = idxStatus >= 0 ? (values[idxStatus] ?? "").toString().trim() : "";

      // If Status column exists: only READY
      if (idxStatus >= 0 && status && status.toUpperCase() !== READY_VALUE.toUpperCase()) continue;

      const title = idxTitle >= 0 ? (values[idxTitle] ?? "").toString().trim() : (obj.Title || "").trim();
      const moral = idxMoral >= 0 ? (values[idxMoral] ?? "").toString().trim() : (obj.Moral || "").trim();
      const theme = idxTheme >= 0 ? (values[idxTheme] ?? "").toString().trim() : (obj.Theme || "").trim();

      if (!title && !moral && !theme) continue;

      items.push({
        rowNumber: i + 1, // 1-based + header row already accounted
        title,
        moral,
        theme,
        status: status || null
      });
    }

    return res.json({
      ok: true,
      loaded: items.length,
      sheet: { url: sheetUrl, sheetName: getSheetName() || null },
      items
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/* ----------------------------------------------------
   404 (API only)
---------------------------------------------------- */

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: `Not Found: ${req.method} ${req.path}` });
  }
  return next();
});

/* ----------------------------------------------------
   START SERVER
---------------------------------------------------- */

app.listen(PORT, () => {
  console.log("BossMind AI Video Maker LIVE on port", PORT);
});
