/**
 * BossMind AI Video Maker — server.js
 * Fetches Google Sheets (Published or normal) as CSV, parses rows, returns JSON at /queue
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8080;

// REQUIRED
const SHEET_URL = process.env.GOOGLE_SHEETS_PUBLISHED_URL;

// ---------- Helpers ----------

function toStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Convert common Google Sheets links into a CSV-exportable URL.
 * Supports:
 * - Published: .../pubhtml?gid=XXXX  -> .../pub?output=csv&gid=XXXX
 * - Normal: .../d/<sheetId>/edit...  -> .../export?format=csv&gid=XXXX
 * - If gid missing -> default 0
 */
function normalizeToCsvUrl(inputUrl) {
  const url = toStr(inputUrl);
  if (!url) return "";

  // If already a CSV export URL, keep it.
  if (url.includes("output=csv") || url.includes("format=csv")) return url;

  // Extract gid if present
  const gidMatch = url.match(/[?&]gid=(\d+)/i);
  const gid = gidMatch?.[1] || "0";

  // 1) Published "pubhtml" -> "pub?output=csv"
  // Example:
  // https://docs.google.com/spreadsheets/d/e/<id>/pubhtml?gid=0&single=true
  // -> https://docs.google.com/spreadsheets/d/e/<id>/pub?output=csv&gid=0
  if (url.includes("/pubhtml")) {
    const base = url.split("/pubhtml")[0];
    return `${base}/pub?output=csv&gid=${gid}`;
  }

  // 2) Published sometimes already uses /pub
  if (url.includes("/pub")) {
    const base = url.split("/pub")[0];
    return `${base}/pub?output=csv&gid=${gid}`;
  }

  // 3) Normal sheet: /spreadsheets/d/<sheetId>/edit -> /spreadsheets/d/<sheetId>/export?format=csv&gid=...
  // Works if sheet is public OR published to web OR accessible without auth (public)
  const dMatch = url.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (dMatch?.[1]) {
    const sheetId = dMatch[1];
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }

  // Fallback: return as-is (will likely fail, but error will show the URL)
  return url;
}

function parseCsvToObjects(csvText) {
  const text = toStr(csvText);
  if (!text) return [];

  // Lightweight CSV parser (no dependency):
  // - Handles commas and quotes reasonably well
  // If you later want 100% robust parsing, we can add papaparse.
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++; // handle CRLF
      row.push(cur);
      cur = "";
      // ignore totally empty trailing row
      if (row.some((c) => toStr(c) !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  // last cell
  if (cur.length || row.length) {
    row.push(cur);
    if (row.some((c) => toStr(c) !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((h) => toStr(h));
  const data = [];

  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col_${c + 1}`;
      obj[key] = rows[r][c] ?? "";
    }
    // Skip fully empty object
    if (Object.values(obj).some((v) => toStr(v) !== "")) data.push(obj);
  }

  return data;
}

async function fetchSheetRows() {
  const raw = toStr(SHEET_URL);
  if (!raw) {
    return {
      ok: false,
      status: 500,
      error: "Missing GOOGLE_SHEETS_PUBLISHED_URL in environment variables.",
    };
  }

  const csvUrl = normalizeToCsvUrl(raw);

  let res;
  try {
    res = await fetch(csvUrl, {
      method: "GET",
      headers: {
        "user-agent": "BossMindQueueFetcher/1.0",
        "accept": "text/csv,text/plain,*/*",
      },
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: `Network error while fetching sheet.`,
      details: String(e?.message || e),
      fetched_url: csvUrl,
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: `Failed to fetch Google Sheet (HTTP ${res.status})`,
      fetched_url: csvUrl,
      hint:
        "Make sure the sheet is Published to web OR publicly accessible. The server fetches CSV export.",
      body_snippet: body.slice(0, 200),
    };
  }

  const text = await res.text();
  const rows = parseCsvToObjects(text);

  return {
    ok: true,
    status: 200,
    fetched_url: csvUrl,
    row_count: rows.length,
    rows,
  };
}

// ---------- Routes ----------

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker",
    time: new Date().toISOString(),
  });
});

app.get("/queue", async (req, res) => {
  const result = await fetchSheetRows();

  if (!result.ok) {
    return res.status(result.status || 500).json({
      error: result.error,
      fetched_url: result.fetched_url,
      hint: result.hint,
      details: result.details,
      body_snippet: result.body_snippet,
    });
  }

  return res.json({
    source: "google_sheets_csv",
    fetched_url: result.fetched_url,
    row_count: result.row_count,
    rows: result.rows,
  });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`[BossMind] Backend LIVE on port ${PORT}`);
  console.log(`[BossMind] Queue source (raw): ${SHEET_URL || "(missing)"}`);
  console.log(`[BossMind] Queue source (csv): ${normalizeToCsvUrl(SHEET_URL || "")}`);
});
