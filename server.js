/**
 * BossMind AI Video Generator — server.js (NO-KEYS Google Sheet mode)
 *
 * ✅ Default mode (NO KEYS): reads Google Sheet from GOOGLE_SHEETS_PUBLISHED_URL (CSV)
 * ✅ Optional mode (Keys): if GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 or GOOGLE_SERVICE_ACCOUNT_JSON exists,
 *    you can later re-enable Google Sheets API without changing endpoints.
 *
 * This file fixes:
 * - "Missing service account credentials" (by using Published CSV when keys are not available)
 * - Org policy blocking service account key creation (no keys needed)
 * - googleapis dependency issues (not required in NO-KEYS mode)
 */

import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 8080);

// ================================
// Env
// ================================
const STATUS_FILTER = (process.env.STATUS_FILTER || "READY").trim(); // expected: READY
const RANGE = (process.env.GOOGLE_SHEETS_RANGE || "A1:Z").trim();    // kept for compatibility/logs

const SHEET_NAME = (process.env.GOOGLE_SHEETS_SHEET_NAME || process.env.GOOGLE_SHEETS_TAB || "").trim();
const SPREADSHEET_ID = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim();

const PUBLISHED_URL = (process.env.GOOGLE_SHEETS_PUBLISHED_URL || "").trim();

// Keys mode (optional, not required)
const GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || "").trim();
const GOOGLE_SERVICE_ACCOUNT_JSON = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();

// ================================
// Helpers
// ================================
function logBoot() {
  console.log(`[BossMind] Backend LIVE on port ${PORT}`);
  console.log(`[BossMind] Status filter: ${STATUS_FILTER}`);
  console.log(`[BossMind] Range: ${RANGE}`);
  console.log(`[BossMind] Spreadsheet ID: ${SPREADSHEET_ID || "(not set)"}`);
  console.log(`[BossMind] Tab: ${SHEET_NAME || "(not set)"} `);
  console.log(`[BossMind] Mode: ${isKeysMode() ? "Google Sheets API (Keys present)" : "NO-KEYS Published CSV"}`);
  console.log(`[BossMind] Published URL: ${PUBLISHED_URL ? "SET" : "NOT SET"}`);
}

function isKeysMode() {
  return Boolean(GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || GOOGLE_SERVICE_ACCOUNT_JSON);
}

/**
 * Minimal CSV parser (handles quoted commas and quotes).
 * Returns array of rows, each row is array of cells (strings).
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (c === "\r") continue;

    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += c;
  }

  // last cell
  row.push(cell);
  rows.push(row);

  // remove trailing empty last line if any
  while (rows.length && rows[rows.length - 1].every((v) => (v ?? "").trim() === "")) rows.pop();

  return rows;
}

function rowsToObjects(csvRows) {
  if (!csvRows || csvRows.length < 1) return [];
  const header = csvRows[0].map((h) => (h ?? "").trim());
  const out = [];

  for (let i = 1; i < csvRows.length; i++) {
    const r = csvRows[i];
    if (!r || r.every((v) => (v ?? "").trim() === "")) continue;

    const obj = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c] || `col_${c + 1}`;
      obj[key] = (r[c] ?? "").trim();
    }
    out.push(obj);
  }

  return out;
}

function normalizeStatus(val) {
  return (val || "").toString().trim().toUpperCase();
}

/**
 * Detects status column name in your sheet (supports: Status, status, STATUS)
 */
function getStatusField(sampleObj) {
  if (!sampleObj) return "Status";
  const keys = Object.keys(sampleObj);
  const found = keys.find((k) => k.toLowerCase() === "status");
  return found || "Status";
}

// ================================
// Data layer — NO KEYS (Published CSV)
// ================================
async function readSheetViaPublishedCSV() {
  if (!PUBLISHED_URL) {
    const err = new Error("GOOGLE_SHEETS_PUBLISHED_URL is missing.");
    err.code = "NO_PUBLISHED_URL";
    throw err;
  }

  // Fetch the published CSV
  const res = await fetch(PUBLISHED_URL, { method: "GET" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(`Failed to fetch published CSV. HTTP ${res.status}`);
    err.code = "PUBLISHED_FETCH_FAILED";
    err.details = txt?.slice(0, 500);
    throw err;
  }

  const csvText = await res.text();
  const csvRows = parseCSV(csvText);
  const objects = rowsToObjects(csvRows);

  const statusField = getStatusField(objects[0]);
  const filtered = objects.filter((r) => normalizeStatus(r[statusField]) === normalizeStatus(STATUS_FILTER));

  return {
    mode: "published_csv",
    statusField,
    totalRows: objects.length,
    matchedRows: filtered.length,
    rows: filtered,
  };
}

// ================================
// Routes
// ================================
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker",
    mode: isKeysMode() ? "keys" : "no_keys_published_csv",
    spreadsheetId: SPREADSHEET_ID || null,
    sheetName: SHEET_NAME || null,
    publishedUrlSet: Boolean(PUBLISHED_URL),
    statusFilter: STATUS_FILTER,
    range: RANGE,
  });
});

/**
 * Queue endpoint used by dashboard
 * Returns ONLY rows where Status == STATUS_FILTER (default READY)
 */
app.get("/queue", async (req, res) => {
  try {
    // ✅ Permanent default: NO-KEYS published CSV
    const data = await readSheetViaPublishedCSV();

    return res.json({
      ok: true,
      source: data.mode,
      statusFilter: STATUS_FILTER,
      statusField: data.statusField,
      totalRows: data.totalRows,
      matchedRows: data.matchedRows,
      rows: data.rows,
    });
  } catch (err) {
    const hint =
      "NO-KEYS mode requires: (1) GOOGLE_SHEETS_PUBLISHED_URL set, (2) Publish-to-web is ON, (3) Automatically republish is ON.";

    return res.status(500).json({
      error: "Failed to read Google Sheet (NO-KEYS mode).",
      hint,
      details: err?.message || String(err),
      code: err?.code || "UNKNOWN",
      extra: err?.details || null,
    });
  }
});

app.listen(PORT, () => logBoot());
