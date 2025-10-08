import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { fetchWithParallelProxy } from '@/utils/proxyService';

interface WatchHistoryItem {
  id: number;
  title: string;
  media_type: 'movie' | 'tv';
  poster_path?: string;
  watched_at: number; // timestamp
  season?: number;
  episode?: number;
  progress?: number; // percentage watched
  server?: string; // which streaming server was used
  server_url?: string; // the URL of the server that was used
}

interface WatchHistoryContextType {
  watchHistory: WatchHistoryItem[];
  addToWatchHistory: (item: Omit<WatchHistoryItem, 'watched_at'>) => void;
  removeFromWatchHistory: (id: number, media_type: string) => void;
  clearWatchHistory: () => void;
  isInWatchHistory: (id: number, media_type: string) => boolean;
  getWatchHistoryItem: (id: number, media_type: string) => WatchHistoryItem | undefined;
  updateWatchProgress: (
    id: number, 
    media_type: string, 
    progress: number, 
    season?: number, 
    episode?: number,
    server?: string,
    server_url?: string
  ) => void;
  getLastWatchedEpisode: (showId: number) => { season: number; episode: number } | null;
  isEpisodeWatched: (showId: number, season: number, episode: number) => boolean;
}

const WatchHistoryContext = createContext<WatchHistoryContextType | null>(null);

export const useWatchHistory = () => {
  const context = useContext(WatchHistoryContext);
  if (!context) {
    throw new Error('useWatchHistory must be used within a WatchHistoryProvider');
  }
  return context;
};

interface WatchHistoryProviderProps {
  children: ReactNode;
}

export const WatchHistoryProvider: React.FC<WatchHistoryProviderProps> = ({ children }) => {
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>(() => {
    try {
      const savedHistory = localStorage.getItem('watchHistory');
      if (!savedHistory) return [];
      const parsedHistory = JSON.parse(savedHistory);
      if (!Array.isArray(parsedHistory)) return [];
      return parsedHistory.filter(item => item && typeof item === 'object' && typeof item.id === 'number' && typeof item.media_type === 'string');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'watchHistory' && e.newValue) {
        try {
          const newHistory = JSON.parse(e.newValue);
          if (Array.isArray(newHistory)) {
            setWatchHistory(newHistory);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('watchHistory')) {
      try {
        localStorage.setItem('watchHistory', JSON.stringify([]));
      } catch {}
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    } catch {}
  }, [watchHistory]);

  const addToWatchHistory = (item: Omit<WatchHistoryItem, 'watched_at'>) => {
    setWatchHistory(prevHistory => {
      try {
        let newHistory = [...prevHistory];
        newHistory = newHistory.filter(historyItem => !(historyItem.id === item.id && historyItem.media_type === item.media_type));
        const newItem = { ...item, watched_at: Date.now() };
        const updatedHistory = [newItem, ...newHistory.slice(0, 99)];
        try {
          localStorage.setItem('watchHistory', JSON.stringify(updatedHistory));
        } catch {}
        return updatedHistory;
      } catch {
        return prevHistory;
      }
    });
  };

  const removeFromWatchHistory = (id: number, media_type: string) => {
    setWatchHistory(prevHistory => {
      const filteredHistory = prevHistory.filter(item => !(item.id === id && item.media_type === media_type));
      try {
        localStorage.setItem('watchHistory', JSON.stringify(filteredHistory));
      } catch {}
      return filteredHistory;
    });
  };

  const clearWatchHistory = () => {
    setWatchHistory([]);
    try {
      localStorage.setItem('watchHistory', JSON.stringify([]));
    } catch {}
  };

  const isInWatchHistory = (id: number, media_type: string) => {
    return watchHistory.some(item => item.id === id && item.media_type === media_type);
  };

  const getWatchHistoryItem = (id: number, media_type: string) => {
    return watchHistory.find(item => item.id === id && item.media_type === media_type);
  };

  const updateWatchProgress = (
    id: number,
    media_type: string,
    progress: number,
    season?: number,
    episode?: number,
    server?: string,
    server_url?: string
  ) => {
    setWatchHistory(prevHistory => {
      const updated = prevHistory.map(item => {
        if (item.id === id && item.media_type === media_type) {
          return {
            ...item,
            progress,
            season: season ?? item.season,
            episode: episode ?? item.episode,
            server: server ?? item.server,
            server_url: server_url ?? item.server_url,
          };
        }
        return item;
      });
      try {
        localStorage.setItem('watchHistory', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const getLastWatchedEpisode = (showId: number) => {
    const episodes = watchHistory.filter(item => item.media_type === 'tv' && item.id === showId && item.season && item.episode);
    if (episodes.length === 0) return null;
    const last = episodes.reduce((a, b) => (a.watched_at > b.watched_at ? a : b));
    return last.season && last.episode ? { season: last.season, episode: last.episode } : null;
  };

  const isEpisodeWatched = (showId: number, season: number, episode: number) => {
    return watchHistory.some(item => item.media_type === 'tv' && item.id === showId && item.season === season && item.episode === episode);
  };

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      watchHistory,
      addToWatchHistory,
      removeFromWatchHistory,
      clearWatchHistory,
      isInWatchHistory,
      getWatchHistoryItem,
      updateWatchProgress,
      getLastWatchedEpisode,
      isEpisodeWatched,
    }),
    [watchHistory]
  );

  return <WatchHistoryContext.Provider value={value}>{children}</WatchHistoryContext.Provider>;
};

export default WatchHistoryProvider; 