import express from "express";

const app = express();
const PORT = process.env.PORT || 8080;

/* =========================
   Middleware
========================= */
app.use(express.json());

/* =========================
   Root – BossMind Index
========================= */
app.get("/", (req, res) => {
  res.type("html").send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>BossMind Core</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont;
      background: #0b0f1a;
      color: #eaeaf0;
      padding: 40px;
    }
    h1 { color: #9ae6ff; }
    code {
      background: #12172a;
      padding: 6px 10px;
      border-radius: 6px;
      display: inline-block;
    }
    a { color: #7dd3fc; text-decoration: none; }
  </style>
</head>
<body>
  <h1>🚀 BossMind Core is Online</h1>
  <p>Status: <strong>RUNNING</strong></p>

  <h3>Available Endpoints</h3>
  <ul>
    <li><code>/health</code> – system health</li>
    <li><code>/api</code> – API index</li>
  </ul>

  <p>Domain: <strong>video.bossmind.ai</strong></p>
</body>
</html>
`);
});

/* =========================
   Health Check
========================= */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    hasStabilityKey: !!process.env.STABILITY_API_KEY,
    engine: "stable-diffusion-xl-1024-v1-0",
    timestamp: new Date().toISOString()
  });
});

/* =========================
   API Index
========================= */
app.get("/api", (req, res) => {
  res.json({
    service: "BossMind Core",
    version: "1.0.0",
    endpoints: ["/health"],
    status: "online"
  });
});

/* =========================
   Start Server
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BossMind Core API listening on http://0.0.0.0:${PORT}`);
});
