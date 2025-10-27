
// src/components/top-movers.js

import { loadFavorites, toggleFavorite, isFavorite } from '../utils/storage.js';
import { byF } from '../services/bybit-api.js';

import { fmt } from '../utils/formatters.js';



async function fetchTopMovers(dir) {
  // Now fetching data from the new backend endpoint /api/movers
  const url = new URL(window.location.origin + '/api/movers');
  url.search = new URLSearchParams({ dir: dir }).toString();
  
  const r = await fetch(url);
  if (!r.ok) throw new Error('API /api/movers error');
  const j = await r.json();
  if (j.retCode !== 0) throw new Error(j.retMsg || 'API /api/movers retCode != 0');
  return j.result.list || [];
}

// Funding rate is now included in the response from /api/movers, so this function is no longer needed.
// It is commented out for reference, but will not be used.
/*
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
*/

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
  // Fetch the pre-sorted list of top movers from the backend API.
  const all = await fetchTopMovers(dir);

  // The list is already filtered and sorted by the backend, so we just use it.
  const topSorted = all;

  // The funding rate is now included in the data fetched from /api/movers, 
  // so the parallel funding fetch is no longer needed.

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
