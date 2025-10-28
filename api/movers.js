// src/pages/api/movers.js

// Несколько зеркал Bybit: пробуем по очереди, пока не получим валидный JSON
const HOSTS = [
  'https://api.bytick.com/v5',
  'https://api.bybit.com/v5',
  'https://api.bybitglobal.com/v5',
];

/** Простая обёртка таймаута для fetch */
function withTimeout(promise, ms, desc = 'request') {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`Timeout ${ms}ms on ${desc}`)), ms);
    promise.then(
      v => { clearTimeout(id); resolve(v); },
      e => { clearTimeout(id); reject(e); }
    );
  });
}

/** Пытаемся сходить на список хостов по очереди. Возвращаем json.result */
async function bybitFetch(path, params = {}, { desc = '' } = {}) {
  const query = new URLSearchParams(params).toString();

  let lastErr;
  for (const base of HOSTS) {
    const url = `${base}${path}?${query}`;
    try {
      const res = await withTimeout(
        fetch(url, {
          // В некоторых регионах CDN режет «пустые» запросы — добавим UA и Accept
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ByAgentBot/1.0)',
            'Accept': 'application/json, text/plain, */*',
          },
          // избегаем кэша CDN/edge
          cache: 'no-store',
          redirect: 'follow',
        }),
        8000,
        url
      );

      const text = await res.text();

      // Бывает, что отдают HTML/капчу — сразу пробуем следующее зеркало
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        lastErr = new Error(`Non-JSON from ${url}: ${text.slice(0, 120)}`);
        continue; // пробуем следующий хост
      }

      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} ${res.statusText} at ${url}`);
        continue;
      }
      if (json.retCode !== 0) {
        lastErr = new Error(`Bybit ${json.retCode}: ${json.retMsg} at ${url}`);
        continue;
      }

      return json.result; // успех
    } catch (e) {
      lastErr = e;
      // пробуем следующий хост
    }
  }

  // если все попытки провалились
  throw lastErr || new Error(`All hosts failed for ${path}${desc ? ` (${desc})` : ''}`);
}

/** Топ растущих/падающих */
async function fetchTopMovers(dir = 'gainers', limit = 50) {
  // Берём публичные тикеры фьючерсов (linear)
  const result = await bybitFetch('/market/tickers', { category: 'linear' }, { desc: 'tickers' });
  const all = Array.isArray(result?.list) ? result.list : [];

  const topSorted = all
    .filter(x => x && x.lastPrice && x.price24hPcnt != null)
    .sort((a, b) => {
      const aP = +a.price24hPcnt;
      const bP = +b.price24hPcnt;
      return dir === 'gainers' ? bP - aP : aP - bP;
    })
    .slice(0, limit);

  // Параллельный сбор funding (если недоступен — просто null, не валим весь ответ)
  const fundingPairs = await Promise.all(
    topSorted.map(async (it) => {
      try {
        const fr = await bybitFetch('/market/funding/history', { symbol: it.symbol, limit: 1 }, { desc: 'funding' });
        const lst = Array.isArray(fr?.list) ? fr.list : [];
        return { symbol: it.symbol, fundingRate: lst.length ? +lst[0].fundingRate : null };
      } catch {
        return { symbol: it.symbol, fundingRate: null };
      }
    })
  );

  const fMap = new Map(fundingPairs.map(x => [x.symbol, x.fundingRate]));
  return topSorted.map(item => ({ ...item, fundingRate: fMap.get(item.symbol) ?? null }));
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
      result: null,
    });
  }
}
