import { fmt } from './formatters.js';
import { fetchAllTickersWithFunding } from '../services/bybit-api.js';
import { getFavorites, toggleFavorite, getAlerts, addAlert, removeAlert } from './storage.js';

// Function to handle the "Найти" (Find) button logic and "Создать алерт" in the Alerts modal
export function setupAlertsModal(drawer) {
  const alertFindBtn = drawer.querySelector('#alertFind');
  const alertSymInput = drawer.querySelector('#alertSym');
  const liveDisplay = drawer.querySelector('#liveTickerDisplay');
  const liveSymbol = drawer.querySelector('#liveTickerSymbol');
  const livePrice = drawer.querySelector('#liveTickerPrice');
  const alertPriceInput = drawer.querySelector('#alertPrice');
  const alertCreateBtn = drawer.querySelector('#alertCreate');
  const alertsList = drawer.querySelector('#activeAlertsList');
  
  let currentLiveSymbol = alertSymInput.value.trim().toUpperCase();

  // Helper to format price (simple simulation)
  function formatPrice(price) {
    return fmt(price, 2);
  }
  
  // Renders the list of active alerts
  function renderAlerts() {
    const alerts = getAlerts();
    if (!alertsList) return;

    if (alerts.length === 0) {
      alertsList.innerHTML = '<div class="mini mono" style="color:var(--muted)">Список алертов пуст.</div>';
      return;
    }

    alertsList.innerHTML = alerts.map(alert => {
      const timeStr = new Date(alert.timestamp).toLocaleTimeString('ru-RU');
      return `
        <div class="row" style="margin-bottom: 6px; padding: 4px 0; border-bottom: 1px dashed rgba(64,64,64,.5); justify-content:space-between; align-items:center;">
          <span class="mono n-blue" style="flex:1 1 80px;">${alert.symbol}</span>
          <span class="mono n-green" style="flex:1 1 80px;">> ${formatPrice(alert.price)}</span>
          <span class="mini mono" style="flex:0 1 100px;">${timeStr}</span>
          <span class="mini mono" style="flex:0 1 40px;">🟢</span>
          <button class="btn delete-alert-btn" data-id="${alert.id}" style="flex:0 1 auto; padding: 4px 8px; font-size: 12px; background: var(--red); border: none;">Удалить</button>
        </div>
      `;
    }).join('');

    // Add delete functionality
    alertsList.querySelectorAll('.delete-alert-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = +e.target.dataset.id;
        removeAlert(id);
        renderAlerts(); // Re-render the list
      });
    });
  }

  // Initial render of alerts
  renderAlerts();

  // 1. "Найти" (Find) button logic
  if (alertFindBtn && alertSymInput) {
    alertFindBtn.addEventListener('click', () => {
      let sym = alertSymInput.value.trim().toUpperCase();
      if (sym && !sym.endsWith('USDT')) {
        sym += 'USDT';
      }
      alertSymInput.value = sym;
      currentLiveSymbol = sym;
      
      // Simulate fetching live price
      const simulatedPrice = (Math.random() * 10000 + 20000); // e.g., 20000 to 30000
      
      liveSymbol.textContent = sym;
      livePrice.textContent = formatPrice(simulatedPrice);
      liveDisplay.style.display = 'flex'; // Show the live display
      
      console.log('Searching for ticker:', sym);
    });
  }

  // 2. "Создать алерт" (Create Alert) button logic
  if (alertCreateBtn && alertPriceInput && alertsList) {
    alertCreateBtn.addEventListener('click', () => {
      const targetPrice = alertPriceInput.value.trim();
      if (!currentLiveSymbol || !targetPrice) {
        alert('Пожалуйста, сначала найдите тикер и введите целевую цену.');
        return;
      }

      const priceNum = parseFloat(targetPrice.replace(/,/g, '.').replace(/\s/g, ''));
      if (isNaN(priceNum) || priceNum <= 0) {
        alert('Введите корректную целевую цену.');
        return;
      }
      
      // Add alert to storage
      addAlert(currentLiveSymbol, priceNum);
      
      // Re-render the list
      renderAlerts();

      // Clear the price input
      alertPriceInput.value = '';
    });
  }
}

// Function that generates the content of the modal window based on the title
export function generateDrawerContent(title) {
  let content = '';
  let apiPath = '';

  switch (title) {
    case 'Копитрейдинг':
      apiPath = '/api/leaderboard';
      content = `
        <div>Копитрейдинг ByAgent Alpha</div>
        <div class="mini mono" style="margin-top:4px;">${apiPath} подключим на бэкенде (демо).</div>
      `;
      break;
    case 'Спреды':
      apiPath = '/api/spreads';
      content = `
        <div>Спреды • BTCUSDT</div>
        <div class="mini mono" style="margin-top:4px;">${apiPath} подключим на бэкенде (демо).</div>
      `;
      break;
    case 'DeFi':
      apiPath = '/api/defi';
      content = `
        <div>DeFi доходности • BTC</div>
        <div class="mini mono" style="margin-top:4px;">${apiPath} подключим на бэкенде (демо).</div>
      `;
      break;
    case 'Сигналы 10x':
      content = `
        <div>Сигналы 10x</div>
        <div class="mini mono" style="margin-top:4px;">Модуль в разработке.</div>
      `;
      break;
    case '⭐ Избранное':
      content = `
        <div style="display:flex; align-items:center; gap:8px;"><span style="font-size:20px;">⭐</span> Избранное</div>
        <div class="row" style="margin-top:10px; gap:8px;">
          <input id="favSymInput" class="input" placeholder="Добавить тикер (напр. BTCUSDT)" style="flex:1 1 200px;"/>
          <button id="addFavBtn" class="btn">Добавить</button>
        </div>
        <div id="favoritesList" style="margin-top:10px;">Загрузка...</div>
      `;
      setTimeout(async()=>{ 
        try{ 
          document.querySelector('#favoritesList').innerHTML = await renderFavoritesHTML(); 
          
          // Add event listener for adding a new favorite
          const addFavBtn = document.querySelector('#addFavBtn');
          if (addFavBtn) {
            addFavBtn.addEventListener('click', () => {
              const symInput = document.querySelector('#favSymInput');
              let sym = symInput.value.trim().toUpperCase();
              if (sym && !sym.endsWith('USDT')) {
                sym += 'USDT';
              }
              if (sym) {
                toggleFavorite(sym);
                document.querySelector('#favoritesList').innerHTML = renderFavoritesHTML(); // Re-render immediately
                symInput.value = '';
              }
            });
          }
        }catch(e){ 
          document.querySelector('#favoritesList').textContent = 'Ошибка загрузки: '+e.message; 
        } 
      });
      break;
    case 'Wallet':
      content = `
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span>Wallet / Подписка (TON)</span>
          <span class="mini mono n-red">Не активна</span>
        </div>
        <h3 style="margin:16px 0 8px 0; color:var(--text);">Wallet / Подписка</h3>
        <div class="row">
          <button class="btn" style="flex:0 1 auto;">Подключить TON Wallet</button>
          <div class="pill"><span class="k mono">Адрес:</span><span class="mono">—</span></div>
          <div class="pill"><span class="k mono">Баланс:</span><span class="mono">—</span></div>
        </div>
        <h3 style="margin:16px 0 8px 0; color:var(--text);">Подписка ByAgent — доступ на 30 дней</h3>
        <div class="mini mono" style="margin-bottom:12px;">Стоимость: 2 TON (демо-оплата)</div>
        <div class="row" style="align-items:center; gap:16px;">
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" style="width:16px; height:16px;"> Я принимаю условия использования
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" style="width:16px; height:16px;"> Согласен с политикой конфиденциальности
          </label>
        </div>
        <button class="btn" style="margin-top:20px; flex:0 1 auto;">Продлить подписку за 2 TON</button>
        <div class="mini mono" style="margin-top:8px; color:var(--muted)">Подключите кошелёк и отметьте оба чекбокса</div>
      `;
      break;
    case 'Алерты':
      content = `
        <div>Алерты</div>
        <div class="row" style="margin-top:10px; align-items:center;">
          <span style="font-size:20px;">⚠️</span>
          <div class="mini mono" style="flex:1 1 auto;">Чтобы получать уведомления, запусти бота <a href="https://t.me/by_agent_boty_agent_bot" target="_blank" style="color:var(--silver);">@By_agent_bot</a> и нажми Start.</div>
          <button class="btn" style="flex:0 1 auto;">Открыть бота</button>
        </div>
        <h3 style="margin:20px 0 8px 0; color:var(--text); display:flex; justify-content:space-between; align-items:center;">
          <span>Ценовые алерты</span>
          <span class="mini mono">Уведомления в Telegram</span>
        </h3>
        <!-- Live Ticker and Price Display -->
        <div id="liveTickerDisplay" class="card" style="margin-bottom: 10px; padding: 10px; display: none; align-items: center; justify-content: space-between;">
          <span id="liveTickerSymbol" class="mono sym n-blue" style="font-size: 1.2em;">—</span>
          <span id="liveTickerPrice" class="mono n-green" style="font-size: 1.2em;">—</span>
        </div>
        <!-- Ticker Search Row -->
        <div class="row" style="gap:8px; margin-bottom: 8px;">
          <input id="alertSym" class="input" value="BTCUSDT" placeholder="Тикер (напр. BTC)" style="flex:1 1 180px;"/>
          <button id="alertFind" class="btn" style="flex:0 1 auto; padding: 11px 16px;">Найти</button>
        </div>
        <!-- Alert Creation Row -->
        <div class="row" style="gap:8px;">
          <input id="alertPrice" class="input" placeholder="Целевая цена" style="flex:1 1 180px;"/>
          <button id="alertCreate" class="btn" style="flex:0 1 auto; padding: 11px 16px;">Создать алерт</button>
        </div>
        <div class="mini mono" style="margin-top:8px; color:var(--muted)">Подключите бота, чтобы получать уведомления.</div>

        <h3 style="margin:20px 0 8px 0; color:var(--text);">Активные алерты</h3>
        <div id="activeAlertsList" style="border: 1px solid var(--border); border-radius: 12px; padding: 10px; background: rgba(0,0,0,.15); max-height: 200px; overflow-y: auto;">
          <div class="mini mono" style="color:var(--muted)">Список алертов пуст.</div>
        </div>
      `;
      break;
    case 'Сетапы':
      content = `<div id="setupsBox" class="mini mono">Загрузка...</div>`;
      setTimeout(async()=>{ try{ document.querySelector('#setupsBox').innerHTML = await renderSetupsHTML(); }catch(e){ document.querySelector('#setupsBox').textContent = 'Ошибка: '+e.message; } });
      break;
    case 'Аномалии':
      content = `<div id="anomBox" class="mini mono">Загрузка...</div>`;
      setTimeout(async()=>{ try{ document.querySelector('#anomBox').innerHTML = await renderAnomaliesHTML(); }catch(e){ document.querySelector('#anomBox').textContent = 'Ошибка: '+e.message; } });
      break;
    case 'Топ рост/падение':
      content = `<div id="moversBox" class="mini mono">Загрузка...</div>`;
      setTimeout(async()=>{ try{ document.querySelector('#moversBox').innerHTML = await renderTopMoversHTML(); }catch(e){ document.querySelector('#moversBox').textContent = 'Ошибка: '+e.message; } });
      break;
    case 'Листинги':
      apiPath = '/api/listings';
      content = `
        <div>Листинги (новые / предстоящие)</div>
        <div class="mini mono" style="margin-top:4px;">${apiPath} подключим на бэкенде (демо).</div>
      `;
      break;
    case 'Доходность App':
      apiPath = '/api/stats';
      content = `
        <div>Доходность приложения</div>
        <div class="mini mono" style="margin-top:4px;">${apiPath} подключим на бэкенде (демо).</div>
      `;
      break;
    default:
      content = `<p class="mini">Модуль «${title}» в разработке.</p>`;
      break;
  }

  return content;
}

export aexport async function renderTopMoversHTML(){
  const allTickers = await fetchAllTickersWithFunding();
  
  const rows = allTickers.map(t => ({
    sym: t.symbol,
    last: t.lastPrice,
    ch: t.price24hPcnt,
    funding: t.fundingRate,
    turn: t.turnover24h
  }));
  
  const gain = [...rows].sort((a, b) => b.ch - a.ch).slice(0, 50); // Топ 50
  const lose = [...rows].sort((a, b) => a.ch - b.ch).slice(0, 50); // Топ 50

  const line = (x) => `
    <div class="row" style="justify-content:space-between;gap:8px;align-items:center;padding:4px 0;">
      <div class="mono" style="min-width:110px;">
        <span style="cursor:pointer;" data-action="select-sym" data-sym="${x.sym}">${x.sym}</span>
      </div>
      <div class="mono" style="min-width:90px;">${fmt.price(x.last)}</div>
      <div class="mono" style="min-width:70px;color:${x.ch >= 0 ? 'var(--green)' : 'var(--red)'}">${x.ch.toFixed(2)}%</div>
      <div class="mono" style="min-width:70px;color:${x.funding >= 0 ? 'var(--green)' : 'var(--red)'}">${(x.funding * 100).toFixed(4)}%</div>
      <div>${makeActionIcons(x.sym, x.last)}</div>
    </div>`;

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <h3>Топ рост (24ч)</h3>
        <div class="mini mono" style="margin-bottom:4px;">Тикер | Цена | %24ч | Фандинг</div>
        <div style="max-height:480px;overflow-y:auto;border:1px solid var(--panel);padding:8px;border-radius:8px;">
          ${gain.map(line).join('')}
        </div>
      </div>
      <div>
        <h3>Топ падение (24ч)</h3>
        <div class="mini mono" style="margin-bottom:4px;">Тикер | Цена | %24ч | Фандинг</div>
        <div style="max-height:480px;overflow-y:auto;border:1px solid var(--panel);padding:8px;border-radius:8px;">
          ${lose.map(line).join('')}
        </div>
      </div>
    </div>
    <div class="row" style="margin-top:12px;justify-content:center;">
      <button class="btn n-green" style="width:50%" onclick="sendTestTelegram()">📩 Отправить тестовый алерт в Telegram</button>
    </div>
    `;
}\"width:100%\" onclick=\"sendTestTelegram()\">📩 Отправить тестовый алерт в Telegram</button></div>
</div>
      </div>
    </div>`;
}

function makeActionIcons(sym, last){
  const fav = `<button class="btn" data-action="toggle-fav" data-sym="${sym}" data-fav-icon="${sym}" style="padding:2px 6px;">☆</button>`;
  const al  = `<button class="btn" data-action="quick-alert" data-sym="${sym}" data-price="${last}" style="padding:2px 6px;">🔔</button>`;
  const sel = `<button class="btn" data-action="select-sym" data-sym="${sym}" style="padding:2px 6px;">📈</button>`;
  const isFav = getFavorites().includes(sym);
  const fav = `<button class="btn" data-action="toggle-fav" data-sym="${sym}" style="padding:2px 6px;">${isFav ? '⭐' : '☆'}</button>`;
  const al  = `<button class="btn" data-action="quick-alert" data-sym="${sym}" data-price="${last}" style="padding:2px 6px;">🔔</button>`;
  const sel = `<button class="btn" data-action="select-sym" data-sym="${sym}" style="padding:2px 6px;">📈</button>`;
  return sel + ' ' + fav + ' ' + al;
}

// --- Setup and Anomalies are using a simplified logic for demonstration ---
// The user requested: объемы, количество активных сделок и участников, по индикаторам, ратио, и по всем актуальным показателям
// The current implementation uses EMA50/200 and RSI, which is a good start for "по индикаторам"
// We will enhance the display with Volume (Turnover) from the ticker data.

export async function renderSetupsHTML(){
  const allTickers = await fetchAllTickersWithFunding();
  const base = allTickers.slice(0, 60); // Limit to 60 for performance in a single run

  // Fetch klines for the selected base symbols
  const kl = await Promise.all(base.map(async r=>{
    try {
      const k = await byF('/v5/market/kline',{symbol:r.symbol, interval:'15', limit:200});
      const list = (k?.list||[]).map(a=>({t:+a[0], c:+a[4]})).sort((x,y)=>x.t-y.t);
      return { sym:r.symbol, rows:list, turn: r.turnover24h, funding: r.fundingRate };
    } catch (e) {
      console.error(`Error fetching kline for ${r.symbol}:`, e);
      return { sym:r.symbol, rows:[], turn: r.turnover24h, funding: r.fundingRate };
    }
  }));

  // Simple EMA and RSI calculation (moved from utils/indicators.js, which doesn't exist)
  function ema(arr,p){ const k=2/(p+1); let e=null; return arr.map(v=>e=e==null?v:v*k+e*(1-k)); }
  function rsi(cl,period=14){ let g=0,l=0,rs=new Array(cl.length).fill(NaN);
    for(let i=1;i<cl.length;i++){const d=cl[i]-cl[i-1]; g=(g*(period-1)+Math.max(d,0))/period; l=(l*(period-1)+Math.max(-d,0))/period; if(i>=period){const r=l===0?100:100-(100/(1+(g/(l||1e-9)))); rs[i]=r;} } return rs;}

  const out=[];
  for(const k of kl){
    const c=k.rows.map(r=>r.c); 
    if(c.length<200) continue; // Need enough data for EMA200
    
    const e50=ema(c,50).slice(-1)[0];
    const e200=ema(c,200).slice(-1)[0];
    const r=rsi(c,14).slice(-1)[0];
    const last=c[c.length-1];
    
    let tag=null; 
    // Simplified Intraday Setup Logic: Price above EMAs and RSI > 55 for LONG, or vice versa for SHORT
    if(last>e50 && e50>e200 && r>55) tag='LONG'; 
    else if(last<e50 && e50<e200 && r<45) tag='SHORT';
    
    if(tag) {
      out.push({
        sym: k.sym,
        last: last,
        tag: tag,
        rsi: r,
        turn: k.turn,
        funding: k.funding
      });
    }
  }
  // Sort by confidence (RSI distance from 50) and then by LONG/SHORT
  out.sort((a,b)=>a.tag===b.tag?Math.abs(b.rsi-50)-Math.abs(a.rsi-50):(a.tag==='LONG'?-1:1));

  const line = (x)=>`
    <div class="row" style="justify-content:space-between;gap:8px;align-items:center;padding:4px 0;">
      <div class="mono" style="min-width:120px;">
        <span style="cursor:pointer;" data-action="select-sym" data-sym="${x.sym}">${x.sym}</span>
      </div>
      <div class="mono" style="min-width:90px;">${fmt.price(x.last)}</div>
      <div class="mono" style="min-width:70px;color:${x.tag==='LONG'?'var(--green)':'var(--red)'}">${x.tag}</div>
      <div class="mono" style="min-width:70px;">RSI ${isFinite(x.rsi)?x.rsi.toFixed(1):'—'}</div>
      <div class="mono" style="min-width:80px;">Vol ${fmt.num(x.turn)}</div>
      <div class="mono" style="min-width:70px;color:${x.funding >= 0 ? 'var(--green)' : 'var(--red)'}">${(x.funding * 100).toFixed(4)}%</div>
      <div>${makeActionIcons(x.sym, x.last)}</div>
    </div>`;

  return `
    <div class="mini mono" style="margin-bottom:4px;">Тикер | Цена | Сетап | RSI | Объем | Фандинг</div>
    <div style="max-height:480px;overflow-y:auto;border:1px solid var(--panel);padding:8px;border-radius:8px;">
      ${out.length > 0 ? out.map(line).join('') : '<div class="mini mono">Нет подходящих сетапов по текущим критериям.</div>'}
    </div>`;
}

export async function renderAnomaliesHTML(){
  const allTickers = await fetchAllTickersWithFunding();
  
  const rows = allTickers.map(t => ({
    sym: t.symbol,
    last: t.lastPrice,
    ch24: t.price24hPcnt,
    turn: t.turnover24h,
    funding: t.fundingRate
  }));
  
  // Anomaly Score: High Change + High Volume (Turnover) + High/Low Funding Rate
  // The user requested: аномальным ростом/падением, по натр, мега активности и всем аномальным показателям
  // Formula: Abs(Change) * Weight + Log10(Turnover + 1) * Weight + Abs(Funding) * Weight
  const top = rows.map(r => {
    const score = (Math.abs(r.ch24) * 1.5) + (Math.log10(r.turn + 1) * 0.8) + (Math.abs(r.funding) * 1000);
    return { ...r, score };
  }).sort((a, b) => b.score - a.score).slice(0, 50); // Топ 50 аномалий

  const line = (x)=>`
    <div class="row" style="justify-content:space-between;gap:8px;align-items:center;padding:4px 0;">
      <div class="mono" style="min-width:110px;">
        <span style="cursor:pointer;" data-action="select-sym" data-sym="${x.sym}">${x.sym}</span>
      </div>
      <div class="mono" style="min-width:90px;">${fmt.price(x.last)}</div>
      <div class="mono" style="min-width:70px;color:${x.ch24 >= 0 ? 'var(--green)' : 'var(--red)'}">${x.ch24.toFixed(2)}%</div>
      <div class="mono" style="min-width:80px;">Vol ${fmt.num(x.turn)}</div>
      <div class="mono" style="min-width:70px;color:${x.funding >= 0 ? 'var(--green)' : 'var(--red)'}">${(x.funding * 100).toFixed(4)}%</div>
      <div>${makeActionIcons(x.sym, x.last)}</div>
    </div>`;
    
  return `
    <div class="mini mono" style="margin-bottom:4px;">Тикер | Цена | %24ч | Объем | Фандинг</div>
    <div style="max-height:480px;overflow-y:auto;border:1px solid var(--panel);padding:8px;border-radius:8px;">
      ${top.map(line).join('')}
    </div>`;
}
  const allTickers = await fetchAllTickersWithFunding();
  
  const rows = allTickers.map(t => ({
    sym: t.symbol,
    last: t.lastPrice,
    ch24: t.price24hPcnt,
    turn: t.turnover24h,
    funding: t.fundingRate
  }));
  
  // Anomaly Score: High Change + High Volume (Turnover) + High/Low Funding Rate
  // The user requested: аномальным ростом/падением, по натр, мега активности и всем аномальным показателям
  // Formula: Abs(Change) * Weight + Log10(Turnover + 1) * Weight + Abs(Funding) * Weight
  const top = rows.map(r => {
    const score = (Math.abs(r.ch24) * 1.5) + (Math.log10(r.turn + 1) * 0.8) + (Math.abs(r.funding) * 1000);
    return { ...r, score };
  }).sort((a, b) => b.score - a.score).slice(0, 50); // Топ 50 аномалий

  const line = (x)=>`
    <div class="row" style="justify-content:space-between;gap:8px;align-items:center;padding:4px 0;">
      <div class="mono" style="min-width:110px;">
        <span style="cursor:pointer;" data-action="select-sym" data-sym="${x.sym}">${x.sym}</span>
      </div>
      <div class="mono" style="min-width:90px;">${fmt.price(x.last)}</div>
      <div class="mono" style="min-width:70px;color:${x.ch24 >= 0 ? 'var(--green)' : 'var(--red)'}">${x.ch24.toFixed(2)}%</div>
      <div class="mono" style="min-width:80px;">Vol ${fmt.num(x.turn)}</div>
      <div class="mono" style="min-width:70px;color:${x.funding >= 0 ? 'var(--green)' : 'var(--red)'}">${(x.funding * 100).toFixed(4)}%</div>
      <div>${makeActionIcons(x.sym, x.last)}</div>
    </div>`;
    
  return `
    <div class="mini mono" style="margin-bottom:4px;">Тикер | Цена | %24ч | Объем | Фандинг</div>
   return `<div style="max-height:480px;overflow-y:auto;border:1px solid var(--panel);padding:8px;border-radius:8px;">${top.map(line).join('')}</div>`;
}

export async function renderFavoritesHTML() {
  const favorites = getFavorites();
  if (favorites.length === 0) {
    return '<div class="mini mono">Список избранного пуст.</div>';
  }

  // Fetch fresh data for favorites
  const allTickers = await fetchAllTickersWithFunding();
  const favTickers = allTickers.filter(t => favorites.includes(t.symbol));

  const lines = favTickers.map(t => {
    const isFav = true; // It is a favorite, so it's true
    const favIcon = isFav ? '⭐' : '☆';
    const price = t.lastPrice;
    const ch = t.price24hPcnt;
    const funding = t.fundingRate;

    return `
      <div class="row" style="justify-content:space-between;gap:8px;align-items:center;padding:4px 0;border-bottom:1px dashed var(--border);">
        <div class="mono" style="min-width:110px;">
          <span style="cursor:pointer;" data-action="select-sym" data-sym="${t.symbol}">${t.symbol}</span>
        </div>
        <div class="mono" style="min-width:90px;">${fmt.price(price)}</div>
        <div class="mono" style="min-width:70px;color:${ch >= 0 ? 'var(--green)' : 'var(--red)'}">${ch.toFixed(2)}%</div>
        <div class="mono" style="min-width:70px;color:${funding >= 0 ? 'var(--green)' : 'var(--red)'}">${(funding * 100).toFixed(4)}%</div>
        <div>
          <button class="btn" data-action="toggle-fav" data-sym="${t.symbol}" style="padding:2px 6px;">❌ Удалить</button>
          <button class="btn" data-action="quick-alert" data-sym="${t.symbol}" data-price="${price}" style="padding:2px 6px;">🔔 Алерт</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="mini mono" style="margin-bottom:4px;">Тикер | Цена | %24ч | Фандинг</div>
    <div style="max-height:480px;overflow-y:auto;border:1px solid var(--panel);padding:8px;border-radius:8px;">
      ${lines.length > 0 ? lines : '<div class="mini mono">Не удалось получить данные для избранных тикеров.</div>'}
    </div>`;
}

export function quickAlert(sym, price) {
  // Logic to open the Alerts modal and pre-fill the symbol and price
  const drawer = document.getElementById('drawer');
  const drawerTitle = document.getElementById('drawerTitle');
  const drawerBody = document.getElementById('drawerBody');

  drawerTitle.textContent = 'Алерты';
  drawerBody.innerHTML = generateDrawerContent('Алерты');
  drawer.classList.add('show');

  // Wait for the next tick to ensure the new HTML is in the DOM and setupAlertsModal is called
  setTimeout(() => {
    const alertSymInput = drawer.querySelector('#alertSym');
    const alertPriceInput = drawer.querySelector('#alertPrice');

    if (alertSymInput) alertSymInput.value = sym;
    if (alertPriceInput) alertPriceInput.value = price > 0 ? fmt(price, 2) : '';
    
    // Simulate a click on 'Найти' to load the live price
    const alertFindBtn = drawer.querySelector('#alertFind');
    if (alertFindBtn) alertFindBtn.click();
    
    document.getElementById('chartWrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}>`;
}

export function sendTestTelegram(){
  const chatId = prompt('Введите ваш Telegram chat_id для теста:');
  if(!chatId) return;
  fetch('/api/telegram', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id: chatId, text: '⚠️ Тестовый алерт от ByAgent Terminal' })
  }).then(r=>r.json()).then(j=>{
    alert(j.success?'Отправлено ✅':'Ошибка: '+(j.error||'unknown'));
  }).catch(e=>alert('Ошибка: '+e.message));
}
