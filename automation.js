const http = require("http");
const url = require("url");

/* ===============================
   Railway Runtime Configuration
================================ */
const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

/* ===============================
   BossMind Runtime State
================================ */
const STATE = {
  app: "ai-video-maker",
  bossmind: true,
  startedAt: new Date().toISOString(),
  lastTickAt: null,
  tickCount: 0,
  lastError: null,
};

/* ===============================
   BossMind Automation Loop
================================ */
function runAutomationTick() {
  try {
    STATE.tickCount += 1;
    STATE.lastTickAt = new Date().toISOString();
    console.log(`🟣 Tick #${STATE.tickCount} { message: 'tick ok' }`);
  } catch (err) {
    STATE.lastError = err.message;
    console.error("Automation error:", err);
  }
}

// Run every 30 seconds (safe for Railway)
setInterval(runAutomationTick, 30_000);

/* ===============================
   HTTP Server (API + Health)
================================ */
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  res.setHeader("Content-Type", "application/json");

  /* ---- HEALTH / ROOT ---- */
  if (parsedUrl.pathname === "/" || parsedUrl.pathname === "/health") {
    res.writeHead(200);
    return res.end(JSON.stringify({ ok: true, ...STATE }));
  }

  /* ---- STATUS ---- */
  if (parsedUrl.pathname === "/status") {
    res.writeHead(200);
    return res.end(JSON.stringify(STATE));
  }

  /* ---- API: VIDEO GENERATION (placeholder) ---- */
  if (parsedUrl.pathname === "/api/video/generate" && req.method === "POST") {
    res.writeHead(200);
    return res.end(
      JSON.stringify({
        ok: true,
        message: "Video generation endpoint ready",
        engine: "BossMind",
        next: "Stability / Runway / Luma",
      })
    );
  }

  /* ---- API: ADMIN ---- */
  if (parsedUrl.pathname === "/api/admin") {
    res.writeHead(200);
    return res.end(
      JSON.stringify({
        ok: true,
        admin: true,
        automationRunning: true,
      })
    );
  }

  /* ---- NOT FOUND ---- */
  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
});

/* ===============================
   Start Server
================================ */
server.listen(PORT, HOST, () => {
  console.log(`✅ Server listening on ${HOST}:${PORT}`);
  console.log("🤖 BossMind 24/7 Automation Started");
});
