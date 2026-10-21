export interface Box { minX: number; maxX: number; minZ: number; maxZ: number }

/** Push a circle (player) out of axis-aligned boxes in the XZ plane. */
export function resolveCircle(x: number, z: number, r: number, boxes: Box[]): { x: number; z: number } {
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const b of boxes) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        const push = r - d;
        x += (dx / d) * push;
        z += (dz / d) * push;
      } else {
        // centre is inside the box: leave through the nearest face
        const l = x - b.minX, rr = b.maxX - x, t = z - b.minZ, bt = b.maxZ - z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) x = b.minX - r;
        else if (m === rr) x = b.maxX + r;
        else if (m === t) z = b.minZ - r;
        else z = b.maxZ + r;
      }
      moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
}
