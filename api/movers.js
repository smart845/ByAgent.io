// api/movers.js
// Vercel Serverless Function to fetch top gainers/losers from Bybit API
// This is required because the frontend code expects the data from /api/movers,
// and direct client-side calls to Bybit API are rate-limited and less flexible.

const BYBIT_API_BASE = 'https://api.bybit.com/v5';

// Helper function to fetch data from Bybit API
async function bybitFetch(path, params = {}) {
    const url = new URL(BYBIT_API_BASE + path);
    url.search = new URLSearchParams({ category: 'linear', ...params }).toString();

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

// Function to fetch all linear tickers and sort them to get top movers
async function fetchTopMovers(dir = 'gainers', limit = 50) {
    // 1. Fetch all linear tickers
    const result = await bybitFetch('/market/tickers');
    const all = result.list || [];

    // 2. Filter and sort
    const topSorted = all
        .filter(x => x.lastPrice && x.price24hPcnt != null)
        .sort((a, b) => {
            // Sort by 24h percentage change (price24hPcnt)
            const aPcnt = +a.price24hPcnt;
            const bPcnt = +b.price24hPcnt;
            return (dir === 'gainers' ? bPcnt - aPcnt : aPcnt - bPcnt);
        })
        .slice(0, limit);

    // 3. Fetch latest funding rate for the top symbols (in parallel)
    // The original frontend code was doing this, so we replicate it here for completeness
    const symbolsToFetch = topSorted.map(item => item.symbol);
    const fundingRates = await Promise.all(symbolsToFetch.map(async (symbol) => {
        try {
            const fundingResult = await bybitFetch('/market/funding/history', { symbol, limit: 1 });
            const list = fundingResult.list || [];
            return { symbol, fundingRate: list.length ? +list[0].fundingRate : null };
        } catch (e) {
            console.error(`Error fetching funding for ${symbol}:`, e.message);
            return { symbol, fundingRate: null };
        }
    }));

    // 4. Merge funding rates back into the main list
    const fundingMap = new Map(fundingRates.map(item => [item.symbol, item.fundingRate]));
    const finalResult = topSorted.map(item => ({
        ...item,
        fundingRate: fundingMap.get(item.symbol)
    }));

    return finalResult;
}

// Vercel Serverless Function handler
export default async (req, res) => {
    // Set CORS headers for Vercel deployment
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { dir } = req.query; // Expects ?dir=gainers or ?dir=losers
        const data = await fetchTopMovers(dir);
        
        // Return data in a format compatible with the frontend's original expectation
        // The frontend expects the data to be an array of objects
        res.status(200).json({ retCode: 0, retMsg: 'OK', result: { list: data } });

    } catch (error) {
        console.error('API /api/movers error:', error.message);
        res.status(500).json({
            retCode: 10001,
            retMsg: `Internal Server Error: ${error.message}`,
            result: null
        });
    }
};
