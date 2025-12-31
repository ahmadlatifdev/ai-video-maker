// automation.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ✅ Prevent HTML caching (appearance stays consistent after deploys)
app.use((req, res, next) => {
  const isHtml =
    req.path === "/" ||
    req.path.endsWith(".html");

  if (isHtml) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }
  next();
});

// Static files
app.use(express.static(publicDir));

// Routes
app.get("/", (req, res) => res.sendFile(path.join(publicDir, "automation.html")));
app.get("/automation.html", (req, res) => res.sendFile(path.join(publicDir, "automation.html")));
app.get("/admin.html", (req, res) => res.sendFile(path.join(publicDir, "admin.html")));

// Health (already working)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-video-maker",
    time: new Date().toISOString()
  });
});

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`BossMind Automation running on port ${PORT}`));
