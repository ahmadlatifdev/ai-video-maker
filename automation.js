const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

/**
 * Root – confirms server is alive
 */
app.get("/", (req, res) => {
  res.send("Hello World");
});

/**
 * Health check – used by BossMind + GitHub Actions
 */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    hasStabilityKey: !!process.env.STABILITY_API_KEY,
    engine: "stable-diffusion-xl-1024-v1-0"
  });
});

/**
 * START SERVER
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BossMind Core API listening on http://0.0.0.0:${PORT}`);
});
