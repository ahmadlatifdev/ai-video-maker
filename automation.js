// automation.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// --------------------
// Paths (ESM-safe)
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------
// Middleware
// --------------------
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// --------------------
// Serve static dashboard files
// --------------------
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Make /automation.html work explicitly
app.get("/automation.html", (req, res) => {
  res.sendFile(path.join(publicDir, "automation.html"));
});

// Optional: root opens the dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "automation.html"));
});

// --------------------
// Health check (required)
// --------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-video-maker",
    time: new Date().toISOString(),
  });
});

// --------------------
// Start
// --------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`BossMind Automation running on port ${PORT}`);
});
