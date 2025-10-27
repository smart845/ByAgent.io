
// src/components/top-movers.js

import { loadFavorites, toggleFavorite, isFavorite } from '../utils/storage.js';
import { byF } from '../services/bybit-api.js';

import { fmt } from '../utils/formatters.js';



async function fetchLinearTickers() {
  // The existing logic is the most efficient way to get top movers, as Bybit API V5 
  // does not have a dedicated 'top gainers/losers' endpoint. We fetch all linear tickers
  // and sort them by 24h change (price24hPcnt).
  const j = await byF('/v5/market/tickers');
  return j.list || [];
}

async function fetchLatestFunding(symbol) {
  // Using funding history, we take the last item
  try {
    const j = await byF('/v5/market/funding/history', { symbol, limit: 1 });
    const lst = j.list || [];
    return lst.length ? +lst[0].fundingRate : null;
  } catch (e) {
    // API call might fail for some symbols, return null
    return null;
  }
}

function moverRow(item) {
  const star = isFavorite(item.symbol) ? '★' : '☆';
  const funding = item.fundingRate == null ? '—' : (+(item.fundingRate)*100).toFixed(4) + '%';
  const pct = (+(item.price24hPcnt)*100).toFixed(2);
  return `
    <div class="mover-row" data-sym="${item.symbol}">
      <button class="fav-btn" title="Избранное">${star}</button>
      <div class="sym">${item.symbol}</div>
      <div class="price mono">${fmt(item.lastPrice, 6)}</div>
      <div class="pct mono ${pct>=0?'n-green':'n-red'}">${pct}%</div>
      <div class="funding mono">${funding}</div>
      <button class="alert-btn" title="Добавить алерт">🔔</button>
    </div>`;
}

export async function renderTopMovers(container, dir='gainers') {
  container.innerHTML = `<div class="mini">Загрузка топов ${dir==='gainers'?'роста':'падения'}...</div>`;
  // Fetch all linear tickers. This is the only way to get 24h change for all symbols.
  const all = await fetchLinearTickers();

  // Filter out invalid data, sort by 24h percentage change, and take the top 50.
  // This is the core logic for determining "top movers" as there is no dedicated API endpoint.
  const topSorted = all
     .filter(x => x.lastPrice && x.price24hPcnt != null)
     .sort((a,b)=> (dir==='gainers' ? +b.price24hPcnt - +a.price24hPcnt : +a.price24hPcnt - +b.price24hPcnt))
     .slice(0, 50);

  // fetch funding with small concurrency
  const concurrency = 6;
  let idx = 0;
  async function worker() {
    while (idx < topSorted.length) {
      const i = idx++;
      const s = topSorted[i].symbol;
      try {
        const fr = await fetchLatestFunding(s);
        topSorted[i].fundingRate = fr;
      } catch {}
    }
  }
  await Promise.all(Array.from({length:concurrency}, worker));

  container.innerHTML = `
    <div class="movers-head row" style="gap:8px;align-items:center;margin-bottom:8px;">
      <div class="badge">Показано: ${topSorted.length}</div>
      <div class="spacer"></div>
      <div class="mini">Нажми ☆ чтобы добавить в избранное, 🔔 — создать алерт</div>
    </div>
    <div class="movers-list">
      <div class="mover-row head">
        <div></div><div>Тикер</div><div>Цена</div><div>Изм. 24ч</div><div>Фандинг</div><div></div>
      </div>
      ${topSorted.map(moverRow).join('')}
    </div>
  `;

  // scrolling is native via CSS; attach handlers
  container.querySelectorAll('.fav-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const row = e.currentTarget.closest('.mover-row');
      const sym = row.dataset.sym;
      toggleFavorite(sym);
      e.currentTarget.textContent = isFavorite(sym) ? '★' : '☆';
    });
  });
  container.querySelectorAll('.sym').forEach(symEl => {
    symEl.addEventListener('click', (e) => {
      const sym = e.currentTarget.textContent.trim();
      if (window.selectSymbol) window.selectSymbol(sym);
      const drawer = document.getElementById('drawer');
      if (drawer) drawer.classList.remove('open');
    });
  });
  container.querySelectorAll('.alert-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const row = e.currentTarget.closest('.mover-row');
      const sym = row.dataset.sym;
      const price = row.querySelector('.price').textContent.replace(/\s/g,'');
      const target = prompt(`Создать алерт для ${sym}. Введите целевую цену:`, price);
      if (!target) return;
      const ev = new CustomEvent('create-alert', { detail: { symbol: sym, target: +target, priceNow: +price } });
      window.dispatchEvent(ev);
    });
  });
}
