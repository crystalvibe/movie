import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';

interface ListItem {
  id: number;
  title: string;
  poster_path?: string;
  media_type: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
}

interface MyListContextType {
  addToList: (item: ListItem) => void;
  removeFromList: (id: number) => void;
  isInList: (id: number, type?: string) => boolean;
  list: ListItem[];
  animatingItems: Set<number>;
}

const MyListContext = createContext<MyListContextType | undefined>(undefined);

export const MyListProvider = ({ children }: { children: ReactNode }) => {
  const [list, setList] = useState<ListItem[]>(() => {
    try {
      const savedList = localStorage.getItem('myList');
      return savedList ? JSON.parse(savedList) : [];
    } catch {
      return [];
    }
  });
  const [animatingItems, setAnimatingItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem('myList', JSON.stringify(list));
    } catch {}
  }, [list]);

  const addToList = (item: ListItem) => {
    setList(prev => {
      if (prev.some(i => i.id === item.id)) return prev;
      return [...prev, item];
    });
    setAnimatingItems(prev => {
      const newSet = new Set(prev);
      newSet.add(item.id);
      setTimeout(() => {
        setAnimatingItems(current => {
          const updated = new Set(current);
          updated.delete(item.id);
          return updated;
        });
      }, 300);
      return newSet;
    });
  };

  const removeFromList = (id: number) => {
    setList(prev => prev.filter(item => item.id !== id));
    setAnimatingItems(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      setTimeout(() => {
        setAnimatingItems(current => {
          const updated = new Set(current);
          updated.delete(id);
          return updated;
        });
      }, 300);
      return newSet;
    });
  };

  const isInList = (id: number, type?: string) => {
    return list.some(item => item.id === id);
  };

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({ list, addToList, removeFromList, isInList, animatingItems }),
    [list, animatingItems]
  );

  return (
    <MyListContext.Provider value={value}>
      {children}
    </MyListContext.Provider>
  );
};

export const useMyList = () => {
  const context = useContext(MyListContext);
  if (context === undefined) {
    throw new Error('useMyList must be used within a MyListProvider');
  }
  return context;
}; 