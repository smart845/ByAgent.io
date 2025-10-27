// api/movers.js
// Serverless API endpoint for Vercel
// Fetches top gainers/losers from Bybit Futures (linear contracts)

const BYBIT_API_BASE = 'https://api.bybit.com/v5';

// --- Helper function to fetch data from Bybit API ---
async function bybitFetch(path, params = {}) {
  const url = new URL(BYBIT_API_BASE + path);
  url.search = new URLSearchParams(params).toString();

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Bybit API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.retCode !== 0) {
    throw new Error(json.retMsg || 'Bybit API retCode != 0');
  }

  return json.result;
}

// --- Main logic to fetch and process top movers ---
async function fetchTopMovers(dir = 'gainers', limit = 50) {
  // ✅ Use instruments-info instead of market/tickers
  const result = await bybitFetch('/market/instruments-info', { category: 'linear' });
  const all = result.list || [];

  // Filter tradable contracts and sort by 24h change percentage
  const topSorted = all
    .filter(x => x.status === 'Trading' && x.lastPrice && x.price24hPcnt != null)
    .sort((a, b) => {
      const aPcnt = +a.price24hPcnt;
      const bPcnt = +b.price24hPcnt;
      return dir === 'gainers' ? bPcnt - aPcnt : aPcnt - bPcnt;
    })
    .slice(0, limit);

  // Fetch latest funding rate for each symbol in parallel
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

  // Merge funding data
  const fundingMap = new Map(fundingRates.map(x => [x.symbol, x.fundingRate]));
  const finalList = topSorted.map(item => ({
    ...item,
    fundingRate: fundingMap.get(item.symbol)
  }));

  return finalList;
}

// --- Serverless function handler ---
export default async (req, res) => {
  // Allow CORS (for frontend fetch)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { dir } = req.query; // ?dir=gainers or ?dir=losers
    const data = await fetchTopMovers(dir || 'gainers');

    // Format response for frontend
    res.status(200).json({
      retCode: 0,
      retMsg: 'OK',
      result: { list: data }
    });
  } catch (error) {
    console.error('API /api/movers error:', error.message);
    res.status(500).json({
      retCode: 10001,
      retMsg: `Internal Server Error: ${error.message}`,
      result: null
    });
  }
};
