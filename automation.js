const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
// HEALTH CHECK (REQUIRED)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-video-maker",
    time: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "BossMind Automation", port: PORT });
});

app.get("/_debug/files", (req, res) => {
  try {
    res.json({ public: fs.readdirSync(PUBLIC_DIR) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ add /admin -> admin.html
app.get("/admin", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

// ✅ add /automation -> automation.html
app.get("/automation", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "automation.html"));
});

app.get("/", (req, res) => {
  res.send("BossMind Automation Server is running");
});

app.listen(PORT, () => {
  console.log(`BossMind Automation running on port ${PORT}`);
});
