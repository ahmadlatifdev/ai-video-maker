import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const QUEUE_FILE = path.resolve("./queue.json");

function readQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveQueue(data) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2));
}

app.get("/", (req, res) => {
  res.send("BossMind AI Video Engine Online");
});

app.post("/enqueue", (req, res) => {
  const queue = readQueue();
  queue.push(req.body);
  saveQueue(queue);
  res.json({ status: "queued", total: queue.length });
});

app.get("/queue", (req, res) => {
  res.json(readQueue());
});

app.get("/reset-queue", (req, res) => {
  saveQueue([]);
  res.json({ status: "queue reset" });
});

app.listen(PORT, () => {
  console.log(`BossMind AI Video Engine running on port ${PORT}`);
});
