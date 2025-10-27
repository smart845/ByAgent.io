// pages/api/movers.js — стабильная версия для Vercel
// Гарантированно не падает, кэширует данные, всегда отдаёт 200 OK

const HOSTS = [
  'https://api.bytick.com/v5',
  'https://api.bybit.com/v5',
  'https://api.bybitglobal.com/v5',
];

let cache = { data: null, ts: 0 };

function withTimeout(promise, ms, desc = 'request') {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`Timeout ${ms}ms on ${desc}`)), ms);
    promise.then(
      v => { clearTimeout(id); resolve(v); },
      e => { clearTimeout(id); reject(e); }
    );
  });
}

async function bybitFetch(path, params = {}, { desc = '' } = {}) {
  const query = new URLSearchParams(params).toString();
  let lastErr;

  for (const base of HOSTS) {
    const url = `${base}${path}?${query}`;
    try {
      const res = await withTimeout(
        fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ByAgentBot/2.0)',
            'Accept': 'application/json, text/plain, */*',
          },
          cache: 'no-store',
          redirect: 'follow',
        }),
        8000,
        url
      );

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        lastErr = new Error(`Non-JSON from ${url}`);
        continue;
      }

      if (!res.ok || json.retCode !== 0 || !json.result) {
        lastErr = new Error(`Bad response from ${url}: ${json.retMsg}`);
        continue;
      }

      return json.result;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  console.warn("⚠️ All Bybit mirrors failed:", lastErr?.message);
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // отдаём кэш, если есть и не старше 60 секунд
  if (cache.data && Date.now() - cache.ts < 60_000) {
    return res.status(200).json(cache.data);
  }

  try {
    const [tickers, funding] = await Promise.all([
      bybitFetch('/market/tickers', { category: 'linear' }, { desc: 'tickers' }),
      bybitFetch('/market/funding/history', { category: 'linear' }, { desc: 'funding' }),
    ]);

    if (!tickers) {
      const fallback = { retCode: 1, retMsg: 'Bybit unreachable – fallback', result: [] };
      return res.status(200).json(fallback);
    }

    const result = { retCode: 0, retMsg: 'OK', result: tickers };
    cache = { data: result, ts: Date.now() };
    return res.status(200).json(result);
  } catch (err) {
    console.error('Unexpected error in /api/movers:', err);
    const fallback = { retCode: 1, retMsg: 'Unexpected error – fallback', result: [] };
    return res.status(200).json(fallback);
  }
}
