// automation.js — COMPLETE (Auth + Static + Admin + Jobs API + Logs)

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 8080;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// -------------------------
// Simple Cookie Helpers
// -------------------------
function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function isAuthed(req) {
  if (!ADMIN_TOKEN) return false;
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.bm_admin === ADMIN_TOKEN;
}

// -------------------------
// In-memory Logs Buffer
// -------------------------
const LOGS_MAX = 300;
const logs = [];

function pushLog(level, message, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message: String(message),
    meta: meta ? meta : null,
  };
  logs.push(entry);
  while (logs.length > LOGS_MAX) logs.shift();
}

const origLog = console.log;
const origWarn = console.warn;
const origErr = console.error;

console.log = (...args) => {
  pushLog("log", args.join(" "));
  origLog(...args);
};
console.warn = (...args) => {
  pushLog("warn", args.join(" "));
  origWarn(...args);
};
console.error = (...args) => {
  pushLog("error", args.join(" "));
  origErr(...args);
};

// -------------------------
// Block direct admin.html access (force /admin + auth)
// -------------------------
app.use((req, res, next) => {
  const p = (req.path || "").toLowerCase();
  if (p.endsWith("/admin.html") || p === "/admin.html") {
    return res.status(404).send("Not Found");
  }
  next();
});

// Serve static files (public)
app.use(express.static(path.join(__dirname, "public")));

// -------------------------
// Public Endpoints
// -------------------------
app.get("/", (req, res) => res.send("BossMind AI Video Maker — ACTIVE"));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "BossMind Core API",
    timestamp: new Date().toISOString(),
  });
});

// -------------------------
// Admin Login + Protected Admin
// -------------------------
app.get("/admin", (req, res) => {
  if (!ADMIN_TOKEN) {
    return res
      .status(500)
      .send("ADMIN_TOKEN is missing in Railway Variables.");
  }

  if (!isAuthed(req)) {
    // Inline login page (no extra files)
    return res.status(200).send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>BossMind Admin Login</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#07080c;color:#e7ecf6;display:flex;min-height:100vh;align-items:center;justify-content:center}
    .box{width:min(520px,92vw);border:1px solid #1b2231;border-radius:16px;background:#0c0f16;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.55)}
    h1{margin:0 0 10px;font-size:16px;letter-spacing:.4px}
    p{margin:0 0 14px;color:#a7b3c8;font-size:13px;line-height:1.5}
    input{width:100%;padding:12px 12px;border-radius:12px;border:1px solid #1b2231;background:#0a0d13;color:#e7ecf6;font-size:14px;outline:none}
    button{margin-top:12px;width:100%;padding:12px;border-radius:12px;border:1px solid rgba(215,180,106,.35);background:rgba(215,180,106,.10);color:#d7b46a;font-size:14px;cursor:pointer}
    button:hover{background:rgba(215,180,106,.14)}
    .hint{margin-top:10px;font-size:12px;color:#a7b3c8}
  </style>
</head>
<body>
  <div class="box">
    <h1>BossMind Admin</h1>
    <p>Enter your <b>ADMIN_TOKEN</b> to unlock the dashboard.</p>
    <form method="POST" action="/admin/login">
      <input name="token" placeholder="Paste ADMIN_TOKEN here" autocomplete="off" />
      <button type="submit">Unlock Admin</button>
    </form>
    <div class="hint">If you lost the token, open Railway → Variables → ADMIN_TOKEN.</div>
  </div>
</body>
</html>
    `);
  }

  // Serve the real dashboard
  return res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/admin/login", express.urlencoded({ extended: false }), (req, res) => {
  const token = (req.body && req.body.token) ? String(req.body.token).trim() : "";
  if (!ADMIN_TOKEN) return res.status(500).send("ADMIN_TOKEN missing.");
  if (token !== ADMIN_TOKEN) return res.status(401).send("Invalid token.");

  // Set auth cookie
  res.setHeader(
    "Set-Cookie",
    `bm_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`
  );
  return res.redirect("/admin");
});

app.post("/admin/logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    `bm_admin=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`
  );
  return res.redirect("/admin");
});

// -------------------------
// Protect all /api/*
// -------------------------
app.use("/api", (req, res, next) => {
  if (!ADMIN_TOKEN) return res.status(500).json({ error: "ADMIN_TOKEN missing" });
  if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });
  next();
});

// -------------------------
// Jobs Queue (in-memory v1)
// -------------------------
let jobSeq = 1;
const jobs = []; // newest first

app.post("/api/jobs", (req, res) => {
  const title = (req.body && req.body.title) ? String(req.body.title).trim() : "";
  const prompt = (req.body && req.body.prompt) ? String(req.body.prompt).trim() : "";

  if (!title || !prompt) {
    return res.status(400).json({ error: "title and prompt are required" });
  }

  const job = {
    id: String(jobSeq++),
    title,
    prompt,
    status: "queued", // queued | running | done | failed | canceled
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  jobs.unshift(job);
  pushLog("log", `JOB QUEUED #${job.id} — ${job.title}`);
  return res.json({ ok: true, job });
});

app.get("/api/jobs", (req, res) => {
  return res.json({ ok: true, jobs });
});

app.post("/api/jobs/:id/cancel", (req, res) => {
  const id = String(req.params.id);
  const job = jobs.find((j) => j.id === id);
  if (!job) return res.status(404).json({ error: "job not found" });

  if (job.status === "done" || job.status === "failed") {
    return res.status(400).json({ error: `cannot cancel a ${job.status} job` });
  }

  job.status = "canceled";
  job.updatedAt = new Date().toISOString();
  pushLog("warn", `JOB CANCELED #${job.id} — ${job.title}`);
  return res.json({ ok: true, job });
});

// -------------------------
// Logs Viewer (real server logs buffer)
// -------------------------
app.get("/api/logs", (req, res) => {
  const limit = Math.max(1, Math.min(300, Number(req.query.limit || 120)));
  const slice = logs.slice(-limit);
  return res.json({ ok: true, logs: slice });
});

// Keep alive
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BossMind Web Server running on port ${PORT}`);
});
