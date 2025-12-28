const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// ====================
// BOSSMIND CORE API
// ====================

// 1. Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'BossMind Core',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    automation_ticks: tickCounter
  });
});

// 2. Project status
app.get('/api/projects', (req, res) => {
  res.json({
    projects: [
      { name: 'AI Video Maker', url: 'https://video.bossmind.ai', status: 'online', db: 'bossmind_ai_video' },
      { name: 'AI Builder', url: 'https://ai-builder.bossmind.ai', status: 'setup', db: 'bossmind_ai_builder' },
      { name: 'E-Commerce AI', url: 'https://ecom.bossmind.ai', status: 'offline', db: 'bossmind_ecom' }
    ]
  });
});

// 3. Trigger AI task (example)
app.post('/api/trigger/video', (req, res) => {
  const { prompt, duration } = req.body;
  // In reality, call Stability AI / RunwayML here
  res.json({
    job_id: 'vid_' + Date.now(),
    status: 'queued',
    message: `Video generation started: "${prompt}"`
  });
});

// 4. Admin endpoint (protected later)
app.get('/admin/status', (req, res) => {
  res.json({
    system: 'BossMind 24/7',
    version: '1.0',
    automation_running: true,
    last_tick: new Date().toISOString(),
    next_tick_in: 10 - (tickCounter % 10)
  });
});

// ====================
// 24/7 AUTOMATION LOOP
// ====================
let tickCounter = 0;

function automationLoop() {
  tickCounter++;
  console.log(`🤖 BossMind Tick #${tickCounter} – ${new Date().toISOString()}`);

  // In reality: check each project, run scheduled tasks, call AI APIs, etc.
  // Example: monitor project URLs
  const projects = ['https://video.bossmind.ai'];
  projects.forEach(url => {
    // Simulate health check
    console.log(`   ✅ ${url} – monitored`);
  });
}

// Start loop every 10 seconds
setInterval(automationLoop, 10000);

// ====================
// START SERVER
// ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BossMind Core API listening on port ${PORT}`);
  console.log(`✅ Health endpoint: http://0.0.0.0:${PORT}/health`);
  automationLoop(); // First tick
});
