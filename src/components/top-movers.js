
// src/components/top-movers.js
import { CONFIG } from '../../config/constants.js';
import { loadFavorites, toggleFavorite, isFavorite } from '../utils/storage.js';
import { fmt } from '../utils/formatters.js';

async function fetchLinearTickers() {
  const url = new URL(CONFIG.BYBIT.API_BASE + '/v5/market/tickers');
  url.search = new URLSearchParams({ category: 'linear' }).toString();
  const r = await fetch(url);
  if (!r.ok) throw new Error('Bybit tickers error');
  const j = await r.json();
  if (j.retCode !== 0) throw new Error(j.retMsg || 'Bybit tickers retCode != 0');
  return j.result.list || [];
}

async function fetchLatestFunding(symbol) {
  // Using funding history, we take the last item
  const url = new URL(CONFIG.BYBIT.API_BASE + '/v5/market/funding/history');
  url.search = new URLSearchParams({ category: 'linear', symbol, limit: 1 }).toString();
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  if (j.retCode !== 0) return null;
  const lst = j.result.list || [];
  return lst.length ? +lst[0].fundingRate : null;
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
  const all = await fetchLinearTickers();

  // Enrich with funding in parallel (limited)
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
