import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// Список зеркал Bybit, чтобы избежать блокировок по странам
const BYBIT_MIRRORS = [
  "https://api.bytick.com",
  "https://api.bybit.me",
  "https://api.bybits.in",
  "https://api.bybitglobal.com"
];

// Функция для получения данных с Bybit
async function fetchBybitData() {
  const endpoint = "/v5/market/tickers?category=linear";
  let lastError = null;

  for (const base of BYBIT_MIRRORS) {
    const url = ${base}${endpoint};
    console.log(`🌍 Trying ${url}`);
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data?.result?.list) {
          console.log(`✅ Success from ${base}`);
          return data.result.list;
        } else {
          console.warn(`⚠️ Unexpected format from ${base}`);
        }
      } else {
        console.warn(`❌ ${base} returned ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn(`⚠️ Fetch failed from ${base}: ${error.message}`);
      lastError = error;
    }
  }

  throw new Error(`All Bybit mirrors failed${lastError ? : ${lastError.message} : ""}`);
}

// API-роут /api/movers
router.get("/movers", async (req, res) => {
  try {
    const data = await fetchBybitData();

    // Пример сортировки по объему
    const sorted = data
      .filter(i => i.volume24h && !isNaN(Number(i.volume24h)))
      .sort((a, b) => Number(b.volume24h) - Number(a.volume24h))
      .slice(0, 30);

    res.json(sorted);
  } catch (error) {
    console.error("Bybit API error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
