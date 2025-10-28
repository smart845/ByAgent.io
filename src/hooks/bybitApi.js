
// src/hooks/bybitApi.js
// Frontend-only Bybit (Futures linear) helpers: REST + WS + analytics (ATR, OI shock, Delta)
const BASE = "https://api.bybit.com";
const CATEGORY = "linear";

async function jget(url){
  const res = await fetch(url, { headers: { "User-Agent": "byagent-web" } });
  const json = await res.json().catch(()=>({}));
  if(!res.ok || json.retCode !== 0) throw new Error(`Bybit error ret=${json?.retCode} ${json?.retMsg||""}`);
  return json.result;
}

export async function fetchTickers() {
  const data = await jget(`${BASE}/v5/market/tickers?category=${CATEGORY}`);
  return data.list;
}

export async function fetchFundingRate(symbol) {
  try{
    const data = await jget(`${BASE}/v5/market/funding/history?category=${CATEGORY}&symbol=${encodeURIComponent(symbol)}&limit=1`);
    const it = data?.list?.[0];
    return it ? Number(it.fundingRate) : null;
  }catch{ return null; }
}

export async function fetchOpenInterest(symbol) {
  try{
    const data = await jget(`${BASE}/v5/market/open-interest?category=${CATEGORY}&symbol=${encodeURIComponent(symbol)}&interval=5min&limit=1`);
    const it = data?.list?.[0];
    return it ? Number(it.openInterest) : null;
  }catch{ return null; }
}

// --- ATR (Average True Range) from klines ---
export async function fetchATR(symbol, { interval="60", period=14 } = {}){
  // Bybit v5 kline: interval in minutes; "60" = 1h, "240" = 4h, "D" = 1 day (but minutes preferred)
  const limit = Math.max(period+1, 50);
  const data = await jget(`${BASE}/v5/market/kline?category=${CATEGORY}&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`);
  const arr = (data?.list||[])
    .map(row => ({
      open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4])
    }))
    .reverse(); // ensure chronological
  if(arr.length < period+1) return null;

  // TR = max(H-L, |H-prevC|, |L-prevC|). ATR = EMA-like or SMA over 'period'; we'll use SMA for stability on client
  const TR = [];
  for(let i=1;i<arr.length;i++){
    const prevC = arr[i-1].close;
    const {high:h, low:l} = arr[i];
    const tr = Math.max(h-l, Math.abs(h-prevC), Math.abs(l-prevC));
    TR.push(tr);
  }
  if(TR.length < period) return null;
  const recent = TR.slice(-period);
  const atr = recent.reduce((a,b)=>a+b,0)/period;
  const lastClose = arr[arr.length-1].close;
  return { atr, atrPct: lastClose ? (atr/lastClose)*100 : null, lastClose };
}

// --- OI shock: compare last 1h OI to avg of previous 24 values ---
export async function fetchOIShock(symbol){
  const limit = 25;
  const data = await jget(`${BASE}/v5/market/open-interest?category=${CATEGORY}&symbol=${encodeURIComponent(symbol)}&interval=1h&limit=${limit}`);
  const list = data?.list || [];
  if(list.length < 2) return null;
  // v5 returns list of arrays or objects depending on endpoint version; normalize
  const vals = list.map(x => Number(x.openInterest || (Array.isArray(x)? x[1] : x)));
  const last = vals[0] ?? vals[vals.length-1]; // bybit sometimes returns desc order; safeguard
  const arr = vals.slice(1, 25);
  const avg = arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  if(!avg || !last) return null;
  const shockPct = ((last - avg)/avg) * 100;
  return { last, avg, shockPct };
}

// --- Delta: recent trades buy vs sell (approx last few minutes) ---
export async function fetchDelta(symbol, limit=1000){
  try{
    const data = await jget(`${BASE}/v5/market/recent-trade?category=${CATEGORY}&symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
    const list = data?.list || [];
    let buy=0, sell=0;
    for(const t of list){
      const side = (t.side || t.m || t.S || "").toString().toLowerCase(); // side may vary
      const qty = Number(t.size || t.execQty || t.q || 0);
      if(side.startsWith("buy") || side === "b" || side === "true") buy += qty;
      else if(side.startsWith("sell") || side === "s" || side === "false") sell += qty;
    }
    const total = buy + sell;
    const delta = total ? ((buy - sell)/total) * 100 : 0;
    return { buy, sell, delta };
  }catch{
    return null;
  }
}

// --- WS for tickers ---
export function openTickerWS(symbols, onMsg) {
  const ws = new WebSocket("wss://stream.bybit.com/v5/public/linear");
  ws.onopen = () => ws.send(JSON.stringify({ op: "subscribe", args: symbols.map(s => `tickers.${s}`) }));
  ws.onmessage = (ev) => { try { const d = JSON.parse(ev.data); if (d.topic?.startsWith("tickers.")) onMsg(d); } catch {} };
  return () => { try { ws.close(); } catch {} };
}

export function trendStrength(pcnt){ const s = Math.max(-100, Math.min(100, pcnt)); return (s+100)/200; }
