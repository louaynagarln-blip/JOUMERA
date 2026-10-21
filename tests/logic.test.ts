import { describe, expect, it } from 'vitest';
import { resolveCircle } from '../src/controls/collision';
import { NavGrid } from '../src/controls/nav';
import { addLine, setQty, totalCents, MAX_QTY } from '../src/cart';

const wall = { minX: -1, maxX: 1, minZ: -0.1, maxZ: 0.1 };

describe('resolveCircle', () => {
  it('pushes a circle out of a wall', () => {
    expect(resolveCircle(0, 0.2, 0.3, [wall]).z).toBeGreaterThanOrEqual(0.4 - 1e-6);
  });
  it('leaves free circles alone', () => {
    expect(resolveCircle(5, 5, 0.3, [wall])).toEqual({ x: 5, z: 5 });
  });
  it('ejects a centre that is inside a box', () => {
    expect(Math.abs(resolveCircle(0, 0, 0.3, [wall]).z)).toBeGreaterThanOrEqual(0.4 - 1e-6);
  });
});

describe('NavGrid', () => {
  const nav = new NavGrid([{ minX: -10, maxX: 4, minZ: -0.2, maxZ: 0.2 }], { minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
  it('routes through the gap', () => {
    const p = nav.findPath(-5, 5, -5, -5);
    expect(p).not.toBeNull();
    expect(p!.some((pt) => pt.x > 4)).toBe(true);
  });
  it('ends at the goal', () => {
    const p = nav.findPath(0, 5, 8, -5)!;
    expect(p[p.length - 1]).toEqual({ x: 8, z: -5 });
  });
});

describe('cart', () => {
  it('merges identical lines and caps quantity', () => {
    const l = addLine(addLine([], 'a', 'x', 2), 'a', 'x', 100);
    expect(l).toEqual([{ slug: 'a', variant: 'x', qty: MAX_QTY }]);
  });
  it('removes a line at qty 0', () => {
    expect(setQty(addLine([], 'a', 'x'), 'a', 'x', 0)).toEqual([]);
  });
  it('totals in integer cents and skips unpriced items', () => {
    const l = addLine(addLine([], 'a', '', 3), 'b', '', 1);
    expect(totalCents(l, (s) => (s === 'a' ? 19.99 : null))).toBe(5997);
  });
});
