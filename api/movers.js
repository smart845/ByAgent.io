// src/pages/api/movers.js
const BYBIT_API_BASE = 'https://api.bytick.com/v5';

async function bybitFetch(path, params = {}) {
  const url = new URL(BYBIT_API_BASE + path);
  url.search = new URLSearchParams(params).toString();

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ByAgentBot/1.0)',
      'Accept': 'application/json, text/plain, */*'
    }
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Bybit returned non-JSON (${text.slice(0, 100)})`);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  if (json.retCode !== 0) throw new Error(`Bybit error ${json.retCode}: ${json.retMsg}`);
  return json.result;
}

async function fetchTopMovers(dir = 'gainers', limit = 50) {
  // ✅ use market/tickers — public, works for linear
  const result = await bybitFetch('/market/tickers', { category: 'linear' });
  const all = result.list || [];

  const topSorted = all
    .filter(x => x.lastPrice && x.price24hPcnt != null)
    .sort((a, b) => {
      const aPcnt = +a.price24hPcnt;
      const bPcnt = +b.price24hPcnt;
      return dir === 'gainers' ? bPcnt - aPcnt : aPcnt - bPcnt;
    })
    .slice(0, limit);

  const fundingRates = await Promise.all(
    topSorted.map(async (item) => {
      try {
        const fundingResult = await bybitFetch('/market/funding/history', { symbol: item.symbol, limit: 1 });
        const list = fundingResult.list || [];
        return { symbol: item.symbol, fundingRate: list.length ? +list[0].fundingRate : null };
      } catch {
        return { symbol: item.symbol, fundingRate: null };
      }
    })
  );

  const fundingMap = new Map(fundingRates.map(x => [x.symbol, x.fundingRate]));
  return topSorted.map(item => ({ ...item, fundingRate: fundingMap.get(item.symbol) }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { dir } = req.query;
    const data = await fetchTopMovers(dir || 'gainers');
    res.status(200).json({ retCode: 0, retMsg: 'OK', result: { list: data } });
  } catch (error) {
    console.error('❌ /api/movers:', error.message);
    res.status(500).json({
      retCode: 10001,
      retMsg: `Internal Server Error: ${error.message}`,
      result: null
    });
  }
}
