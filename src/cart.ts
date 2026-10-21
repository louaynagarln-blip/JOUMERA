export interface CartLine { slug: string; variant: string; qty: number }
export const MAX_QTY = 20;

const same = (l: CartLine, slug: string, variant: string) => l.slug === slug && l.variant === variant;

export function addLine(lines: CartLine[], slug: string, variant: string, qty = 1): CartLine[] {
  if (!lines.some((l) => same(l, slug, variant))) return [...lines, { slug, variant, qty: Math.min(MAX_QTY, qty) }];
  return lines.map((l) => (same(l, slug, variant) ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l));
}

export function setQty(lines: CartLine[], slug: string, variant: string, qty: number): CartLine[] {
  if (qty <= 0) return lines.filter((l) => !same(l, slug, variant));
  return lines.map((l) => (same(l, slug, variant) ? { ...l, qty: Math.min(MAX_QTY, qty) } : l));
}

/** Display-only estimate in integer cents. The server recomputes the real total. */
export function totalCents(lines: CartLine[], priceOf: (slug: string) => number | null): number {
  let t = 0;
  for (const l of lines) {
    const p = priceOf(l.slug);
    if (p == null) continue;
    t += Math.round(p * 100) * l.qty;
  }
  return t;
}
