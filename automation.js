const http = require("http");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// ===== BossMind Runtime State =====
const STATE = {
  app: "ai-video-maker",
  bossmind: true,
  startedAt: new Date().toISOString(),
  lastTickAt: null,
  tickCount: 0,
  lastError: null,
};

// ===== HTTP SERVER (Railway-compliant) =====
const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, ...STATE }));
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false }));
});

server.listen(PORT, HOST, () => {
  console.log("🤖 BossMind 24/7 Automation Started");
  console.log(`✅ Server listening on ${HOST}:${PORT}`);
});

// ===== BossMind Automation Loop =====
async function runAutomationTick() {
  return { message: "tick ok" };
}

const TICK_SECONDS = Number(process.env.BOSSMIND_TICK_SECONDS || 30);

async function tick() {
  STATE.lastTickAt = new Date().toISOString();
  STATE.tickCount += 1;

  try {
    await runAutomationTick();
    STATE.lastError = null;
    console.log(`🟣 Tick #${STATE.tickCount}`);
  } catch (err) {
    STATE.lastError = String(err);
    console.error("🔴 Tick failed:", err);
  }
}

tick();
setInterval(tick, TICK_SECONDS * 1000);
