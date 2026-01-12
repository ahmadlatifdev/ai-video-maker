/**
 * BossMind Admin API — Complete routes for:
 *  - GET  /health
 *  - GET  /api/admin/health
 *  - GET  /api/admin/switches
 *  - POST /api/admin/switches
 *  - GET  /api/admin/status/system
 *
 * Works even if Supabase tables are missing (returns safe defaults).
 */

import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createClient } from "@supabase/supabase-js";

const app = express();

// ---------- Config ----------
const PORT = process.env.PORT || 3000;

const SERVICE_NAME = process.env.SERVICE_NAME || "ai-video-maker";
const HERO_ENABLED = String(process.env.HERO_ENABLED || "true") === "true";

// Optional admin key protection (if you want it later)
const ADMIN_KEY = process.env.ADMIN_KEY || "";

// Supabase (optional — if missing, we still respond with defaults)
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("tiny"));

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return next(); // admin key not enabled
  const k = req.headers["x-admin-key"];
  if (!k || k !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

// ---------- Helpers ----------
const DEFAULT_SWITCHES = {
  maintenance_mode: "OFF",
  switch_set: "AI Builder",
  deepseek: true,
  stripe_logs: true,
  webhook_triggers: true,
  auto_disable_on_errors: true,
  backups: true,
  notifications: true,
  updated_at: new Date().toISOString(),
};

async function getSwitchesSafe() {
  if (!supabase) {
    return { ...DEFAULT_SWITCHES, source: "defaults_no_supabase" };
  }

  // Try to read latest row from bossmind_switches (recommended table)
  const { data, error } = await supabase
    .from("bossmind_switches")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return {
      ...DEFAULT_SWITCHES,
      source: "defaults_table_missing_or_empty",
      supabase_error: error ? String(error.message || error) : null,
    };
  }

  const row = data[0];
  // Normalize with defaults (so UI never breaks)
  return {
    ...DEFAULT_SWITCHES,
    ...row,
    source: "supabase",
  };
}

async function upsertSwitchesSafe(patch) {
  if (!supabase) {
    return { ok: true, switches: { ...DEFAULT_SWITCHES, ...patch }, source: "defaults_no_supabase" };
  }

  const current = await getSwitchesSafe();
  const next = {
    ...DEFAULT_SWITCHES,
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  // Insert new row (append-only is safest for audit)
  const { data, error } = await supabase
    .from("bossmind_switches")
    .insert([next])
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      error: String(error.message || error),
      attempted: next,
    };
  }

  return { ok: true, switches: data, source: "supabase" };
}

// ---------- Routes ----------
app.get("/health", (req, res) => {
  res.json({ ok: true, service: SERVICE_NAME, hero: HERO_ENABLED, time: new Date().toISOString() });
});

app.get("/api/admin/health", (req, res) => {
  res.json({ ok: true, service: SERVICE_NAME, hero: HERO_ENABLED, time: new Date().toISOString() });
});

// IMPORTANT: your dashboard calls this
app.get("/api/admin/switches", requireAdmin, async (req, res) => {
  const switches = await getSwitchesSafe();
  res.json({ ok: true, switches });
});

// IMPORTANT: your dashboard posts here (was failing before)
app.post("/api/admin/switches", requireAdmin, async (req, res) => {
  const patch = req.body || {};
  const result = await upsertSwitchesSafe(patch);
  if (!result.ok) return res.status(500).json(result);
  res.json(result);
});

// IMPORTANT: your dashboard expects this
app.get("/api/admin/status/system", requireAdmin, async (req, res) => {
  const switches = await getSwitchesSafe();
  res.json({
    ok: true,
    service: SERVICE_NAME,
    hero: HERO_ENABLED,
    supabase: Boolean(supabase),
    switches_source: switches.source,
    time: new Date().toISOString(),
  });
});

// Optional: avoid "Cannot GET /api/admin" confusion
app.get("/api/admin", (req, res) => {
  res.json({
    ok: true,
    hint: "Use /api/admin/health, /api/admin/switches, /api/admin/status/system",
    time: new Date().toISOString(),
  });
});

// ---------- Start ----------
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[${SERVICE_NAME}] listening on :${PORT}`);
});
