// ===============================
// BossMind Automation Server
// ===============================

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------
// Middleware
// -------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------------------
// Serve static files
// -------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------
// Health check (Railway safe)
// -------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BossMind Automation',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------
// Debug: list public files
// -------------------------------
app.get('/_debug/files', (req, res) => {
  const fs = require('fs');
  const publicDir = path.join(__dirname, 'public');

  try {
    const files = fs.readdirSync(publicDir);
    res.json({ public: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------
// Root fallback
// -------------------------------
app.get('/', (req, res) => {
  res.send('BossMind Automation Server is running');
});

// -------------------------------
// Start server
// -------------------------------
app.listen(PORT, () => {
  console.log(`BossMind Automation running on port ${PORT}`);
});
