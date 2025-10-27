// api/movers.js
const BYBIT_API_BASE = 'https://api.bybit.com/v5';

async function bybitFetch(path, params = {}) {
  const url = new URL(BYBIT_API_BASE + path);
  url.search = new URLSearchParams(params).toString();
  console.log('[BybitFetch]', url.toString()); // 👈 логируем реальный запрос

  const response = await fetch(url.toString());
  const text = await response.text(); // читаем как текст для отладки

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON response from Bybit: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  if (json.retCode !== 0) {
    throw new Error(`Bybit error ${json.retCode}: ${json.retMsg}`);
  }

  return json.result;
}

async function fetchTopMovers(dir = 'gainers', limit = 50) {
  console.log('[fetchTopMovers] dir =', dir);
  // ⚠️ заменили endpoint
  const result = await bybitFetch('/market/instruments-info', { category: 'linear' });
  const all = result.list || [];
  console.log('[Bybit returned]', all.length, 'items');

  if (all.length === 0) {
    throw new Error('Bybit returned empty list for /market/instruments-info');
  }

  const topSorted = all
    .filter(x => x.status === 'Trading' && x.lastPrice && x.price24hPcnt != null)
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
      } catch (e) {
        console.error(`Funding fetch error for ${item.symbol}:`, e.message);
        return { symbol: item.symbol, fundingRate: null };
      }
    })
  );

  const fundingMap = new Map(fundingRates.map(x => [x.symbol, x.fundingRate]));
  return topSorted.map(item => ({ ...item, fundingRate: fundingMap.get(item.symbol) }));
}

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { dir } = req.query;
    console.log('[API /movers] Request dir =', dir);
    const data = await fetchTopMovers(dir || 'gainers');

    res.status(200).json({ retCode: 0, retMsg: 'OK', result: { list: data } });
  } catch (error) {
    console.error('❌ API /api/movers error:', error.message);
    res.status(500).json({
      retCode: 10001,
      retMsg: `Internal Server Error: ${error.message}`,
      result: null
    });
  }
};
