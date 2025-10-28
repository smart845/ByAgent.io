
// src/components/Setups.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchTickers, fetchATR, fetchOIShock, fetchDelta } from "../hooks/bybitApi";

function knum(n){ if(n==null) return "-"; const a=Math.abs(Number(n)); if(a>=1e9) return (n/1e9).toFixed(2)+"B"; if(a>=1e6) return (n/1e6).toFixed(2)+"M"; if(a>=1e3) return (n/1e3).toFixed(2)+"K"; return String(n); }

export default function Setups({ onSelect }){
  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState({}); // symbol -> { atrPct, oiShock, delta }

  useEffect(()=>{ (async()=>{
    const list = await fetchTickers();
    const mapped = list.filter(t=>t.symbol.endsWith("USDT")).map(t=>({
      symbol: t.symbol,
      lastPrice: Number(t.lastPrice),
      pct24h: Number(t.price24hPcnt)*100,
      volume24h: Number(t.volume24h),
      turnover24h: Number(t.turnover24h)
    }));
    setRows(mapped);

    // compute metrics for top 60 by liquidity
    const top = [...mapped].sort((a,b)=> b.turnover24h - a.turnover24h).slice(0,60);
    for(const r of top){
      const [atr, oi, d] = await Promise.all([
        fetchATR(r.symbol, { interval: "60", period: 14 }),
        fetchOIShock(r.symbol),
        fetchDelta(r.symbol, 1000)
      ]).catch(()=>[null,null,null]);
      setMetrics(prev => ({ ...prev, [r.symbol]: {
        atrPct: atr?.atrPct ?? null,
        oiShock: oi?.shockPct ?? null,
        delta: d?.delta ?? null
      }}));
    }
  })(); },[]);

  const scalping = useMemo(()=> rows
    .filter(r=>r.turnover24h>5e7)
    .filter(r=>Math.abs(r.pct24h) < 5)
    .slice(0,40), [rows]);

  const intraday = useMemo(()=> rows
    .filter(r=>r.turnover24h>1e8)
    .filter(r=>Math.abs(r.pct24h) >= 5)
    .sort((a,b)=>Math.abs(b.pct24h)-Math.abs(a.pct24h))
    .slice(0,40), [rows]);

  const Row = ({r}) => {
    const m = metrics[r.symbol] || {};
    const oi = m.oiShock, d = m.delta, atr = m.atrPct;
    const oiClass = oi==null ? "" : (oi>=15 ? "text-green-600" : oi<=-15 ? "text-red-600" : "text-gray-700");
    const dClass = d==null ? "" : (d>=10 ? "text-green-600" : d<=-10 ? "text-red-600" : "text-gray-700");
    return (
      <tr className="hover:bg-gray-100 cursor-pointer" onClick={()=>onSelect?.(r.symbol)}>
        <td className="px-2 py-1 font-medium">{r.symbol}</td>
        <td className="px-2 py-1">{r.lastPrice}</td>
        <td className={(r.pct24h>=0?"text-green-600":"text-red-600")+" px-2 py-1"}>{r.pct24h.toFixed(2)}%</td>
        <td className="px-2 py-1">{(r.turnover24h/1e6).toFixed(1)}M</td>
        <td className="px-2 py-1">{atr!=null ? atr.toFixed(2)+"%" : "…"}</td>
        <td className={"px-2 py-1 "+oiClass}>{oi!=null ? (oi>=0?"+":"")+oi.toFixed(1)+"% OI" : "…"}</td>
        <td className={"px-2 py-1 "+dClass}>{d!=null ? (d>=0?"+":"")+d.toFixed(1)+"% Δ" : "…"}</td>
      </tr>
    );
  };

  const Table = ({title, data}) => (
    <div>
      <h3 className="font-medium mb-1">{title}</h3>
      <table className="w-full text-sm">
        <thead><tr><th>Тикер</th><th>Цена</th><th>% 24ч</th><th>$ Объём</th><th>ATR%</th><th>OI-шок</th><th>Δ</th></tr></thead>
        <tbody>{data.map(r => <Row key={r.symbol} r={r}/>)}</tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Сетапы (скальпинг & интрадей)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Table title="Скальпинг — ликвидные и спокойные" data={scalping} />
        <Table title="Интрадей — трендовые/активные" data={intraday} />
      </div>
    </div>
  );
}
