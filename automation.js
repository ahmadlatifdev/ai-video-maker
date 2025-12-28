/**
 * BossMind Core API (Railway)
 * - Fix: Adds missing POST /api/generate/image
 * - Uses Stability AI v1 "text-to-image" endpoint (JSON body)
 *
 * Required env:
 *   STABILITY_API_KEY
 *
 * Optional env:
 *   PORT (Railway sets this)
 *   STABILITY_ENGINE_ID (default: stable-diffusion-xl-1024-v1-0)
 *   STABILITY_API_BASE (default: https://api.stability.ai)
 */

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

try {
  // Optional: only if dotenv exists in your repo
  require('dotenv').config();
} catch (_) {}

const app = express();

// ---------- Config ----------
const PORT = Number(process.env.PORT || 8080);
const STABILITY_API_KEY = process.env.STABILITY_API_KEY || process.env.STABILITY_KEY || '';
const STABILITY_API_BASE = process.env.STABILITY_API_BASE || 'https://api.stability.ai';
const STABILITY_ENGINE_ID = process.env.STABILITY_ENGINE_ID || 'stable-diffusion-xl-1024-v1-0';

// Safety defaults for image gen
const DEFAULTS = {
  steps: 30,
  cfg_scale: 7,
  samples: 1,
  width: 1024,
  height: 1024
};

// ---------- Middleware ----------
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Simple CORS (safe default)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- Helpers ----------
function clampInt(n, min, max, fallback) {
  const v = Number.parseInt(n, 10);
  if (Number.isNaN(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function jsonError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    error: message,
    ...extra
  });
}

async function stabilityTextToImage(prompt, opts = {}) {
  if (!STABILITY_API_KEY) {
    const err = new Error('Missing STABILITY_API_KEY');
    err.status = 500;
    throw err;
  }

  const width = clampInt(opts.width, 256, 1536, DEFAULTS.width);
  const height = clampInt(opts.height, 256, 1536, DEFAULTS.height);
  const steps = clampInt(opts.steps, 10, 80, DEFAULTS.steps);
  const cfg_scale = Number.isFinite(Number(opts.cfg_scale)) ? Number(opts.cfg_scale) : DEFAULTS.cfg_scale;
  const samples = clampInt(opts.samples, 1, 4, DEFAULTS.samples);

  const url = `${STABILITY_API_BASE}/v1/generation/${encodeURIComponent(STABILITY_ENGINE_ID)}/text-to-image`;

  const body = {
    text_prompts: [{ text: String(prompt || '').slice(0, 2000) }],
    cfg_scale,
    height,
    width,
    samples,
    steps
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STABILITY_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}

  if (!r.ok) {
    const msg = data?.message || data?.name || text || `Stability error (${r.status})`;
    const err = new Error(msg);
    err.status = r.status;
    err.details = data || { raw: text };
    throw err;
  }

  // v1 returns: { artifacts: [ { base64, seed, finishReason } ] }
  const artifacts = Array.isArray(data?.artifacts) ? data.artifacts : [];
  const first = artifacts[0];

  if (!first?.base64) {
    const err = new Error('Stability returned no image artifacts');
    err.status = 502;
    err.details = data;
    throw err;
  }

  return {
    engine: STABILITY_ENGINE_ID,
    width,
    height,
    steps,
    cfg_scale,
    samples,
    seed: first.seed ?? null,
    base64: first.base64,
    // Most SDXL engines return PNG; data URL is convenient for quick testing
    data_url: `data:image/png;base64,${first.base64}`
  };
}

// ---------- Routes ----------
app.get('/', (req, res) => {
  res.status(200).json({
    ok: true,
    name: 'BossMind Core API',
    status: 'online',
    endpoints: {
      health: 'GET /health',
      generateImage: 'POST /api/generate/image'
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    status: 'healthy',
    hasStabilityKey: Boolean(STABILITY_API_KEY),
    engine: STABILITY_ENGINE_ID
  });
});

/**
 * FIXED ENDPOINT:
 * POST /api/generate/image
 * Body:
 *   { "prompt": "text", "width":1024, "height":1024, "steps":30, "cfg_scale":7, "samples":1 }
 */
app.post('/api/generate/image', async (req, res) => {
  try {
    const prompt = (req.body?.prompt || '').toString().trim();
    if (!prompt) return jsonError(res, 400, 'Missing "prompt" in request body');

    const result = await stabilityTextToImage(prompt, {
      width: req.body?.width,
      height: req.body?.height,
      steps: req.body?.steps,
      cfg_scale: req.body?.cfg_scale,
      samples: req.body?.samples
    });

    return res.status(200).json({
      ok: true,
      provider: 'stability',
      ...result
    });
  } catch (e) {
    const status = Number(e?.status || 500);
    return jsonError(res, status, e?.message || 'Unknown error', {
      details: e?.details || undefined
    });
  }
});

// 404 fallback (keeps Railway from returning confusing 502s)
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// ---------- Start ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BossMind Core API listening on http://0.0.0.0:${PORT}`);
});
