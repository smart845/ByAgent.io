
// src/components/Anomalies.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchTickers, fetchATR, fetchOIShock, fetchDelta } from "../hooks/bybitApi";

function knum(n){ if(n==null) return "-"; const a=Math.abs(Number(n)); if(a>=1e9) return (n/1e9).toFixed(2)+"B"; if(a>=1e6) return (n/1e6).toFixed(2)+"M"; if(a>=1e3) return (n/1e3).toFixed(2)+"K"; return String(n); }

export default function Anomalies({ onSelect }){
  const [rows, setRows] = useState([]);
  const [m, setM] = useState({}); // metrics

  useEffect(()=>{ (async()=>{
    const list = await fetchTickers();
    const mapped = list.filter(t=>t.symbol.endsWith("USDT")).map(t=>({
      symbol: t.symbol,
      lastPrice: Number(t.lastPrice),
      pct24h: Number(t.price24hPcnt)*100,
      highPrice24h: Number(t.highPrice24h),
      lowPrice24h: Number(t.lowPrice24h),
      turnover24h: Number(t.turnover24h),
      volume24h: Number(t.volume24h)
    }));
    setRows(mapped);

    const top = [...mapped].sort((a,b)=> b.turnover24h - a.turnover24h).slice(0,60);
    for(const r of top){
      const [atr, oi, d] = await Promise.all([
        fetchATR(r.symbol, { interval: "60", period: 14 }),
        fetchOIShock(r.symbol),
        fetchDelta(r.symbol, 1000)
      ]).catch(()=>[null,null,null]);
      setM(prev => ({ ...prev, [r.symbol]: { atrPct: atr?.atrPct ?? null, oi: oi?.shockPct ?? null, d: d?.delta ?? null }}));
    }
  })(); },[]);

  // эвристика аномалии: большой дневной диапазон и/или OI-шок или большая Δ
  const anomalies = useMemo(()=> rows.filter(r=>{
    const mm = m[r.symbol] || {};
    const rangePct = ((r.highPrice24h - r.lowPrice24h) / r.lastPrice) * 100;
    return (rangePct > 10) || (mm.oi!=null && Math.abs(mm.oi) > 15) || (mm.d!=null && Math.abs(mm.d) > 15) || (mm.atrPct!=null && mm.atrPct > 3);
  }).slice(0,100), [rows, m]);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Аномалии рынка (Bybit Futures)</h2>
      <table className="w-full text-sm">
        <thead><tr><th>Тикер</th><th>Цена</th><th>% 24ч</th><th>$ Объём</th><th>Диапазон/цена</th><th>ATR%</th><th>OI-шок</th><th>Δ</th></tr></thead>
        <tbody>
          {anomalies.map(r=> {
            const mm = m[r.symbol] || {};
            const rangePct = ((r.highPrice24h - r.lowPrice24h) / r.lastPrice) * 100;
            const oiClass = mm.oi==null ? "" : (mm.oi>=15 ? "text-green-600" : mm.oi<=-15 ? "text-red-600" : "text-gray-700");
            const dClass = mm.d==null ? "" : (mm.d>=10 ? "text-green-600" : mm.d<=-10 ? "text-red-600" : "text-gray-700");
            return (
              <tr key={r.symbol} className="hover:bg-gray-100 cursor-pointer" onClick={()=>onSelect?.(r.symbol)}>
                <td className="px-2 py-1 font-medium">{r.symbol}</td>
                <td className="px-2 py-1">{r.lastPrice}</td>
                <td className={(r.pct24h>=0?"text-green-600":"text-red-600")+" px-2 py-1"}>{r.pct24h.toFixed(2)}%</td>
                <td className="px-2 py-1">{knum(r.turnover24h)}</td>
                <td className="px-2 py-1">{rangePct.toFixed(1)}%</td>
                <td className="px-2 py-1">{mm.atrPct!=null ? mm.atrPct.toFixed(2)+"%" : "…"}</td>
                <td className={"px-2 py-1 "+oiClass}>{mm.oi!=null ? (mm.oi>=0?"+":"")+mm.oi.toFixed(1)+"%" : "…"}</td>
                <td className={"px-2 py-1 "+dClass}>{mm.d!=null ? (mm.d>=0?"+":"")+mm.d.toFixed(1)+"%" : "…"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
