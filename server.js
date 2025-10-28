import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import moversRouter from "./api/movers.js";
import telegramRouter, { initTelegram } from "./api/telegram.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// API
app.use("/api", moversRouter);
app.use("/api", telegramRouter);

// Init Telegram bot (polling)
initTelegram();

// Static (Vite dist)
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Full app (with Telegram) on ${PORT}`));
