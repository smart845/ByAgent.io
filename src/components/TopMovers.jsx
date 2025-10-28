
// src/components/TopMovers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchTickers, fetchFundingRate, openTickerWS, trendStrength } from "../hooks/bybitApi";
import { getFavorites, toggleFavorite, addAlert } from "../utils/store";

function formatPct(p) { return (p >= 0 ? "+" : "") + p.toFixed(2) + "%"; }
function knum(n) { if (n==null) return "-"; const a = Math.abs(Number(n)); if (a>=1e9) return (n/1e9).toFixed(2)+"B"; if (a>=1e6) return (n/1e6).toFixed(2)+"M"; if (a>=1e3) return (n/1e3).toFixed(2)+"K"; return String(n); }

export default function TopMovers({ onSelect }){
  const [rows, setRows] = useState([]);
  const [funding, setFunding] = useState({});
  const [fav, setFav] = useState(getFavorites());
  const [error, setError] = useState("");

  useEffect(()=>{
    let cancel = null;
    (async()=>{
      try{
        const list = await fetchTickers();
        const mapped = list.filter(t=>t.symbol.endsWith("USDT")).map(t=>({
          symbol: t.symbol,
          lastPrice: Number(t.lastPrice),
          pct24h: Number(t.price24hPcnt)*100,
          volume24h: Number(t.volume24h),
          turnover24h: Number(t.turnover24h)
        }));
        const sorted = [...mapped].sort((a,b)=> b.pct24h - a.pct24h);
        setRows(sorted);
        const syms = sorted.slice(0,50).map(r=>r.symbol);
        cancel = openTickerWS(syms, (msg)=>{
          const s = msg.topic.split(".")[1];
          const d = msg.data?.[0]; if(!d) return;
          setRows(prev => prev.map(r => r.symbol===s ? { ...r, lastPrice: Number(d.lastPrice), pct24h: Number(d.price24hPcnt)*100 } : r));
        });
        syms.forEach(async s => {
          const fr = await fetchFundingRate(s); if(fr==null) return;
          setFunding(prev => ({ ...prev, [s]: fr }));
        });
      }catch(e){ setError(String(e.message||e)); }
    })();
    return ()=> cancel && cancel();
  },[]);

  const gainers = useMemo(()=> rows.slice(0,12), [rows]);
  const losers = useMemo(()=> rows.slice(-12).reverse(), [rows]);

  const Row = ({r}) => {
    const favOn = fav.includes(r.symbol);
    const fr = funding[r.symbol];
    const tstr = trendStrength(r.pct24h);
    return (
      <tr className="hover:bg-gray-100 cursor-pointer" onClick={()=>onSelect?.(r.symbol)}>
        <td className="px-2 py-1">
          <button onClick={(e)=>{e.stopPropagation(); setFav(toggleFavorite(r.symbol));}} title="Favorite">
            {favOn ? "★" : "☆"}
          </button>
        </td>
        <td className="px-2 py-1 font-medium">{r.symbol}</td>
        <td className="px-2 py-1">{r.lastPrice}</td>
        <td className={(r.pct24h>=0?"text-green-600":"text-red-600")+" px-2 py-1"}>{formatPct(r.pct24h)}</td>
        <td className="px-2 py-1">{fr!=null ? (fr*100).toFixed(4)+"%" : "…"}</td>
        <td className="px-2 py-1">{knum(r.turnover24h)}</td>
        <td className="px-2 py-1">{knum(r.volume24h)}</td>
        <td className="px-2 py-1">
          <button className="text-sm underline" onClick={(e)=>{e.stopPropagation(); const p = prompt("Alert price crosses?"); if(!p) return; addAlert(r.symbol,{type:"price_cross", value:Number(p)}); alert("Alert added");}}>+ alert</button>
        </td>
        <td className="px-2 py-1"><div className="w-16 h-2 bg-gray-200 rounded"><div className="h-2 bg-black rounded" style={{width:`${Math.round(tstr*100)}%`}}/></div></td>
      </tr>
    );
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Топ рост / падение (Bybit Futures)</h2>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium mb-1">Рост</h3>
          <table className="w-full text-sm"><thead><tr><th></th><th>Тикер</th><th>Цена</th><th>% 24ч</th><th>Фандинг</th><th>$ Объём</th><th>Контр.</th><th>Алерт</th><th>Тренд</th></tr></thead>
          <tbody>{gainers.map(r=><Row key={r.symbol} r={r}/>)}</tbody></table>
        </div>
        <div>
          <h3 className="font-medium mb-1">Падение</h3>
          <table className="w-full text-sm"><thead><tr><th></th><th>Тикер</th><th>Цена</th><th>% 24ч</th><th>Фандинг</th><th>$ Объём</th><th>Контр.</th><th>Алерт</th><th>Тренд</th></tr></thead>
          <tbody>{losers.map(r=><Row key={r.symbol} r={r}/>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}
