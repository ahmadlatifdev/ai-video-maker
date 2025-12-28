const http = require("http");

const PORT = process.env.PORT || 3000;

// ===== BossMind Runtime State =====
const STATE = {
  app: "ai-video-maker",
  bossmind: true,
  startedAt: new Date().toISOString(),
  lastTickAt: null,
  tickCount: 0,
  lastError: null,
};

// ===== 1) Railway needs an HTTP server listening on PORT =====
const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, ...STATE }));
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not Found" }));
});

server.listen(PORT, () => {
  console.log("🤖 BossMind 24/7 Automation Started");
  console.log(`✅ Server listening on PORT=${PORT}`);
});

// ===== 2) BossMind automation loop (keeps running) =====
// Put your real automation steps inside runAutomationTick().
async function runAutomationTick() {
  // IMPORTANT: keep this fast and safe; no infinite blocking inside a tick
  // TODO: add your real automation actions here (API calls, queue processing, etc.)
  return { message: "tick ok" };
}

const TICK_SECONDS = Number(process.env.BOSSMIND_TICK_SECONDS || 30);

async function tick() {
  STATE.lastTickAt = new Date().toISOString();
  STATE.tickCount += 1;

  try {
    const result = await runAutomationTick();
    STATE.lastError = null;
    console.log(`🟣 Tick #${STATE.tickCount}`, result);
  } catch (err) {
    STATE.lastError = String(err && err.message ? err.message : err);
    console.error("🔴 Automation tick failed:", err);
  }
}

// start immediately, then repeat
tick();
setInterval(tick, TICK_SECONDS * 1000);
