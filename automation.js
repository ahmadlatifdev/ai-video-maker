const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

/* -----------------------------
   HEALTH CHECK
------------------------------ */
app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/health", async (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    hasStabilityKey: !!process.env.STABILITY_API_KEY,
    engine: "stable-diffusion-xl-1024-v1-0"
  });
});

/* -----------------------------
   START SERVER
------------------------------ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BossMind Core API listening on http://0.0.0.0:${PORT}`);
});
