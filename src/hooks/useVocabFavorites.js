import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "thai-vocab-favorites";

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // silently fail
  }
}

export function useVocabFavorites() {
  const [favoriteIds, setFavoriteIds] = useState(loadFavorites);

  useEffect(() => {
    saveFavorites(favoriteIds);
  }, [favoriteIds]);

  const toggleFavorite = useCallback((wordId) => {
    setFavoriteIds((prev) => {
      if (prev.includes(wordId)) {
        return prev.filter((id) => id !== wordId);
      }
      return [...prev, wordId];
    });
  }, []);

  const isFavorite = useCallback(
    (wordId) => favoriteIds.includes(wordId),
    [favoriteIds]
  );

  return { favoriteIds, toggleFavorite, isFavorite, favoriteCount: favoriteIds.length };
}
