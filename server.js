/**
 * BossMind AI Video Maker — Backend (Google Sheets API)
 * ✅ No "Publish to web"
 * ✅ No /d/e/2PACX links
 * ✅ No CSV scraping
 * ✅ Stable 24/7 with Service Account
 */

import express from "express";
import cors from "cors";
import { google } from "googleapis";

const app = express();

// ---- Basics
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 8080);

// ---- Required ENV
// 1) GOOGLE_SERVICE_ACCOUNT_JSON_BASE64  (recommended)  OR  GOOGLE_SERVICE_ACCOUNT_JSON
// 2) GOOGLE_SHEETS_SPREADSHEET_ID        (the sheet id after /d/ in the URL)
// Optional:
// - GOOGLE_SHEETS_TAB  (default: "KokiDodi-1")
// - GOOGLE_SHEETS_RANGE (default: "A1:Z")
// - QUEUE_STATUS_FILTER (default: "READY")  (set empty to disable filter)

function getServiceAccountObject() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (b64) {
    const jsonStr = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(jsonStr);
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) return JSON.parse(raw);

  throw new Error(
    "Missing service account credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 (preferred) or GOOGLE_SERVICE_ACCOUNT_JSON."
  );
}

function normalizeHeaders(headers) {
  return headers.map((h, idx) => {
    const t = String(h ?? "").trim();
    return t.length ? t : `col_${idx + 1}`;
  });
}

function rowsToObjects(values) {
  if (!Array.isArray(values) || values.length === 0) return [];

  const headers = normalizeHeaders(values[0] || []);
  const out = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    // skip fully empty rows
    const hasAny = row.some((c) => String(c ?? "").trim().length > 0);
    if (!hasAny) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c] ?? "";
    }
    out.push(obj);
  }
  return out;
}

async function fetchSheetRows() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID.");
  }

  const tab = (process.env.GOOGLE_SHEETS_TAB || "KokiDodi-1").trim();
  const rangePart = (process.env.GOOGLE_SHEETS_RANGE || "A1:Z").trim();
  const range = `${tab}!${rangePart}`;

  const creds = getServiceAccountObject();

  // Auth (Service Account)
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: "ROWS",
    valueRenderOption: "FORMATTED_VALUE",
  });

  const values = resp?.data?.values || [];
  let rows = rowsToObjects(values);

  // Optional status filter
  const statusFilter = (process.env.QUEUE_STATUS_FILTER ?? "READY").trim();
  if (statusFilter) {
    rows = rows.filter((r) => {
      const s =
        r.Status ??
        r.status ??
        r.STATE ??
        r.State ??
        r.queue_status ??
        r.QueueStatus ??
        "";
      return String(s).trim().toUpperCase() === statusFilter.toUpperCase();
    });
  }

  return { spreadsheetId, tab, range, row_count: rows.length, rows };
}

// ---- Routes
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "ai-video-maker",
    bossmind: true,
    mode: "google-sheets-api",
    time: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy", time: new Date().toISOString() });
});

// ✅ This is the endpoint you wanted to validate
app.get("/queue", async (req, res) => {
  try {
    const data = await fetchSheetRows();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: "Failed to read Google Sheet via API",
      hint:
        "Ensure: (1) Service account JSON is set in Railway env, (2) The Sheet is shared with the service account email as Viewer, (3) Spreadsheet ID + tab name are correct.",
      details: String(err?.message || err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`[BossMind] Backend LIVE on port ${PORT}`);
  console.log(`[BossMind] Mode: Google Sheets API (Service Account)`);
  console.log(`[BossMind] Spreadsheet ID: ${process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "(missing)"}`);
  console.log(`[BossMind] Tab: ${process.env.GOOGLE_SHEETS_TAB || "KokiDodi-1"}`);
  console.log(`[BossMind] Range: ${process.env.GOOGLE_SHEETS_RANGE || "A1:Z"}`);
  console.log(`[BossMind] Status filter: ${process.env.QUEUE_STATUS_FILTER ?? "READY"}`);
});
