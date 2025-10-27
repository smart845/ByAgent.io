
// src/utils/storage.js

const FAVORITES_KEY = 'favorites_list';

export function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
  } catch (e) {
    console.error('Error loading favorites from storage', e);
    return [];
  }
}

export function saveFavorites(favorites) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.error('Error saving favorites to storage', e);
  }
}

export function toggleFavorite(symbol) {
  const favorites = loadFavorites();
  const index = favorites.indexOf(symbol);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push(symbol);
  }
  saveFavorites(favorites);
}

export function isFavorite(symbol) {
  const favorites = loadFavorites();
  return favorites.includes(symbol);
}
