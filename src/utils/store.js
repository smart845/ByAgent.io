
// src/utils/store.js
const FAV_KEY = "byagent:favorites";
const ALERT_KEY = "byagent:alerts";

export function getFavorites(){ try { return JSON.parse(localStorage.getItem(FAV_KEY))||[] } catch { return [] } }
export function setFavorites(v){ localStorage.setItem(FAV_KEY, JSON.stringify(v)); }
export function toggleFavorite(symbol){
  const s = new Set(getFavorites()); s.has(symbol) ? s.delete(symbol) : s.add(symbol);
  const arr = Array.from(s).sort(); setFavorites(arr); return arr;
}
export function getAlerts(){ try { return JSON.parse(localStorage.getItem(ALERT_KEY))||{} } catch { return {} } }
export function setAlerts(v){ localStorage.setItem(ALERT_KEY, JSON.stringify(v)); }
export function addAlert(symbol, rule){
  const a = getAlerts(); a[symbol] = a[symbol] || []; a[symbol].push({ ...rule, id: crypto.randomUUID(), createdAt: Date.now() });
  setAlerts(a); return a[symbol];
}
