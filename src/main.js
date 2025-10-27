import { CONFIG, AppState } from '../config/constants.js'; 
import { by, loadSymbols, normalizeSymbol, mountTV } from './services/bybit-api.js';
import { spawnAgent, setActiveSeg } from './components/agent-analytics.js';
import { spawnOI, refreshOI } from './components/open-interest.js';
import { generateDrawerContent, setupAlertsModal } from './utils/helpers.js';

// === DOM Elements ===
const $ = (id) => document.getElementById(id);
const symInput = $('sym'), symList = $('symList'), btnFind = $('btnFind');
const drawer = $('drawer');
const drawerTitle = $('drawerTitle');
const drawerBody = $('drawerBody');
const drawerClose = $('drawerClose');

// === Initialization ===
async function init() {
  await loadSymbols();
  
  // Set initial symbol and start modules
  const initialSym = AppState.currentSymbol;
  symInput.value = initialSym;
  selectSymbol(initialSym);
  
  // Event Listeners
  btnFind.addEventListener('click', handleFindClick);
  symInput.addEventListener('keydown', handleSymInputKeydown);
  
  // Auto timing buttons for Agent
  document.querySelectorAll('#autoSeg button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      AppState.agentPeriodSec = +btn.dataset.sec;
      setActiveSeg(document.getElementById('autoSeg'), btn);
      spawnAgent();
    });
  });
  
  // OI interval buttons
  document.querySelectorAll('#oiSeg button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      AppState.oiInterval = btn.dataset.int;
      setActiveSeg(document.getElementById('oiSeg'), btn);
      refreshOI(); // refresh immediately on interval change
    });
  });
  
  // Drawer buttons (Wallet, Alerts, and neon-wrap buttons)
  document.querySelectorAll('.neon-wrap .btn, .btn-group-top .btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const title = btn.textContent.trim();
      drawerTitle.textContent = title;
      drawerBody.innerHTML = generateDrawerContent(title);
      drawer.classList.add('show');
      
      // Re-run the logic for favorites to ensure the event listener is set up
      if (title === '⭐ Избранное') {
        // The logic is now inside generateDrawerContent, which uses setTimeout.
        // We ensure the drawer is open and the content generation is triggered.
      }
      
      // Call setup function for the Alerts modal after content is injected
      if (title === 'Алерты') {
        // Wait for the next tick to ensure the new HTML is in the DOM
        setTimeout(() => setupAlertsModal(drawer), 0);
      }
      
      // Auto-scroll to the modal
      setTimeout(() => {
        document.getElementById('chartWrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  });

  // Handle clicks on dynamically generated content (e.g., ticker selection, fav/alert buttons)
  drawer.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (target) {
      const action = target.dataset.action;
      const sym = target.dataset.sym;
      const price = target.dataset.price;

      if (action === 'select-sym') {
        selectSymbol(sym);
        drawer.classList.remove('show'); // Close drawer after selection
      } else if (action === 'toggle-fav') {
        toggleFavorite(sym);
        // Re-render the drawer content if it's "Избранное"
        if (drawerTitle.textContent.trim() === '⭐ Избранное') {
          drawerBody.innerHTML = generateDrawerContent('⭐ Избранное');
        } else {
          // If not in favorites, just show a message or update the button icon (not implemented here)
          console.log(`Toggled favorite for ${sym}`);
        }
      } else if (action === 'quick-alert') {
        quickAlert(sym, price);
      }
    }
  });
  document.querySelectorAll('.neon-wrap .btn, .btn-group-top .btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const title = btn.textContent.trim();
      drawerTitle.textContent = title;
      drawerBody.innerHTML = generateDrawerContent(title);
      drawer.classList.add('show');
      
      // Re-run the logic for favorites to ensure the event listener is set up
      if (title === '⭐ Избранное') {
        // The logic is now inside generateDrawerContent, which uses setTimeout.
        // We ensure the drawer is open and the content generation is triggered.
      }
      
      // Call setup function for the Alerts modal after content is injected
      if (title === 'Алерты') {
        // Wait for the next tick to ensure the new HTML is in the DOM
        setTimeout(() => setupAlertsModal(drawer), 0);
      }
      
      // Auto-scroll to the modal
      setTimeout(() => {
        document.getElementById('chartWrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  });
  
  drawerClose.addEventListener('click', ()=>drawer.classList.remove('show'));
}

// === Event Handlers ===
function handleFindClick() {
  const raw = symInput.value.trim();
  const norm = normalizeSymbol(raw);
  if(!norm){ alert('Введите тикер'); return; }
  symInput.value = norm; // autosuffix USDT if needed
  selectSymbol(norm);
}

function handleSymInputKeydown(e) {
  if(e.key==='Enter'){ e.preventDefault(); btnFind.click(); }
}

// sync everything: agent + chart + OI
export function selectSymbol(sym){
  window.selectSymbol = selectSymbol; // Expose to global scope for use in dynamically generated HTML
  AppState.currentSymbol = sym;
  $('agentSym').textContent = sym;
  $('oiTitleSym').textContent = sym;
  
  // Refresh all modules now
  spawnAgent();
  spawnOI();
  mountTV(sym);
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
