import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import TelegramBot from "node-telegram-bot-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Simple JSON storage (ephemeral on Render)
const storePath = path.join(__dirname, "..", "users.json");
function readUsers() {
  try { return JSON.parse(fs.readFileSync(storePath, "utf-8")); }
  catch { return { users: [] }; }
}
function writeUsers(data) {
  try { fs.writeFileSync(storePath, JSON.stringify(data, null, 2)); }
  catch (e) { console.error("write users.json failed:", e.message); }
}
function addUser({ id, username, first_name, last_name }) {
  const db = readUsers();
  if (!db.users.find(u => u.id === id)) {
    db.users.push({ id, username, first_name, last_name, createdAt: new Date().toISOString() });
    writeUsers(db);
  }
}

let bot = null;
export function initTelegram() {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) { console.warn("⚠️ TELEGRAM_TOKEN not set. Telegram bot disabled."); return; }
  bot = new TelegramBot(token, { polling: true });
  console.log("🤖 Telegram bot started");

  // /start
  bot.onText(/^\/start(?:\s+(.+))?/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name || "друг";
    addUser({ id: msg.from?.id, username: msg.from?.username, first_name: msg.from?.first_name, last_name: msg.from?.last_name });
    const text = `👋 Привет, ${firstName}!

Я — ByAgeny 🤖
Твой персональный ИИ-помощник в трейдинге 📊

💎 Лучшие сигналы и торговые сетапы
📈 Глубокая аналитика и метрики рынка
🤖 ИИ-агент сигналов и автоидей
📊 Открытый интерес в реальном времени
📲 Умные ценовые алерты и уведомления
⭐ Избранное и персональные подборки
🧩 Лучшие сервисы и инструменты в одном месте

⚡ Всё для твоей торговли — в одном помощнике ByAgeny`;
    const shareBtn = { inline_keyboard: [[{ text: "🤝 Поделиться ByAgeny", url: "https://t.me/by_agent_bot" }]] };
    await bot.sendMessage(chatId, text, { reply_markup: shareBtn });
  });

  // /alerts
  bot.onText(/^\/alerts/, async (msg) => {
    const chatId = msg.chat.id;
    addUser({ id: msg.from?.id, username: msg.from?.username, first_name: msg.from?.first_name, last_name: msg.from?.last_name });
    const text = `🔔 Раздел «Алерты»

Я помогу тебе создать ценовые уведомления 💬
Выбери актив и задай условие — я пришлю сообщение, когда оно выполнится.

📊 Пример: BTCUSDT > 68000`;
    const kb = {
      inline_keyboard: [
        [{ text: "➕ Создать алерт", callback_data: "create_alert" }],
        [{ text: "🤝 Поделиться ByAgeny", url: "https://t.me/by_agent_bot" }]
      ]
    };
    await bot.sendMessage(chatId, text, { reply_markup: kb });
  });

  bot.on("callback_query", async (q) => {
    try {
      if (q.data === "create_alert") {
        await bot.answerCallbackQuery({ callback_query_id: q.id, text: "Пришли условие: <Тикер> <оператор> <цена>" });
        await bot.sendMessage(q.message.chat.id, "Например: `BTCUSDT > 68000`\n(демо, потом свяжем с реальным алерт-API)", { parse_mode: "Markdown" });
      }
    } catch (e) {
      console.error("callback_query error:", e.message);
    }
  });
}

// Healthcheck
router.get("/telegram/health", (req, res) => {
  res.json({ ok: !!bot, polling: !!bot });
});

export default router;
