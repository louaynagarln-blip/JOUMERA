import { createStore } from 'zustand/vanilla';
import { addLine, setQty, type CartLine } from './cart';

interface CartState {
  lines: CartLine[];
  add(slug: string, variant: string, qty?: number): void;
  setQty(slug: string, variant: string, qty: number): void;
  clear(): void;
}

const KEY = 'jm.cart';
function load(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((l): l is CartLine => typeof l?.slug === 'string' && typeof l?.variant === 'string' && Number.isInteger(l?.qty) && l.qty > 0);
  } catch { return []; }
}

export const cart = createStore<CartState>((set) => ({
  lines: load(),
  add: (slug, variant, qty = 1) => set((s) => ({ lines: addLine(s.lines, slug, variant, qty) })),
  setQty: (slug, variant, qty) => set((s) => ({ lines: setQty(s.lines, slug, variant, qty) })),
  clear: () => set({ lines: [] }),
}));
cart.subscribe((s) => { try { localStorage.setItem(KEY, JSON.stringify(s.lines)); } catch { /* ignore */ } });
