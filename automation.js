// automation.js
import express from "express";
import cors from "cors";

const app = express();

// ---- middleware ----
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ---- REQUIRED HEALTH ROUTE ----
app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "ai-video-maker",
    time: new Date().toISOString(),
  });
});

// ---- YOUR EXISTING ROUTES (keep yours here) ----
// app.post("/...", ...);
// app.get("/...", ...);

// ---- start ----
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`BossMind Automation running on port ${PORT}`);
});
