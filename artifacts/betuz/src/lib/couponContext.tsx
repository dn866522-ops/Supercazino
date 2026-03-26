import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface CouponItem {
  matchId: string;
  matchName: string;
  betDescription: string;
  odds: number;
}

interface CouponCtx {
  items: CouponItem[];
  addItem: (item: CouponItem) => void;
  removeItem: (matchId: string, betDescription: string) => void;
  clearAll: () => void;
  totalOdds: number;
  hasItem: (matchId: string, betDescription: string) => boolean;
}

const CouponContext = createContext<CouponCtx>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  clearAll: () => {},
  totalOdds: 1,
  hasItem: () => false,
});

export function CouponProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CouponItem[]>([]);

  const addItem = useCallback((item: CouponItem) => {
    setItems(prev => {
      const exists = prev.find(i => i.matchId === item.matchId && i.betDescription === item.betDescription);
      if (exists) return prev;
      const filtered = prev.filter(i => i.matchId !== item.matchId);
      return [...filtered, item];
    });
  }, []);

  const removeItem = useCallback((matchId: string, betDescription: string) => {
    setItems(prev => prev.filter(i => !(i.matchId === matchId && i.betDescription === betDescription)));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  const hasItem = useCallback((matchId: string, betDescription: string) => {
    return items.some(i => i.matchId === matchId && i.betDescription === betDescription);
  }, [items]);

  const totalOdds = parseFloat(
    items.reduce((acc, i) => acc * i.odds, 1).toFixed(4)
  );

  return (
    <CouponContext.Provider value={{ items, addItem, removeItem, clearAll, totalOdds, hasItem }}>
      {children}
    </CouponContext.Provider>
  );
}

export function useCoupon() {
  return useContext(CouponContext);
}
