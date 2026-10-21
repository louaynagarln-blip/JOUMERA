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

/** Subdivision prevents a long step from crossing thin glass and preserves wall sliding. */
export function moveCircle(x: number, z: number, dx: number, dz: number, r: number, boxes: Box[]): { x: number; z: number } {
  if (![x, z, dx, dz, r].every(Number.isFinite) || r <= 0) throw new Error('Invalid movement');
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * .5)));
  for (let i = 0; i < steps; i++) {
    const next = resolveCircle(x + dx / steps, z + dz / steps, r, boxes);
    x = next.x; z = next.z;
  }
  return { x, z };
}

/** Exact swept-circle clearance against XZ boxes, including very thin glass. */
export function clearWalkSegment(a: { x: number; z: number }, c: { x: number; z: number }, radius: number, boxes: Box[]): boolean {
  if (![a.x, a.z, c.x, c.z, radius].every(Number.isFinite) || radius <= 0) return false;
  const dx = c.x - a.x, dz = c.z - a.z;
  const length2 = dx * dx + dz * dz;
  const pointDistance = (p: {x: number; z: number}, b: Box) =>
    Math.max(b.minX - p.x, 0, p.x - b.maxX) ** 2 + Math.max(b.minZ - p.z, 0, p.z - b.maxZ) ** 2;
  for (const b of boxes) {
    let lo = 0, hi = 1;
    for (const [origin, delta, min, max] of [[a.x, dx, b.minX, b.maxX], [a.z, dz, b.minZ, b.maxZ]]) {
      if (Math.abs(delta) < 1e-12) { if (origin < min || origin > max) hi = -1; }
      else { const u = (min - origin) / delta, v = (max - origin) / delta; lo = Math.max(lo, Math.min(u, v)); hi = Math.min(hi, Math.max(u, v)); }
    }
    if (lo <= hi) return false;
    let distance2 = Math.min(pointDistance(a, b), pointDistance(c, b));
    for (const x of [b.minX, b.maxX]) for (const z of [b.minZ, b.maxZ]) {
      const t = length2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / length2)) : 0;
      distance2 = Math.min(distance2, (x - a.x - t * dx) ** 2 + (z - a.z - t * dz) ** 2);
    }
    if (distance2 < radius * radius - 1e-9) return false;
  }
  return true;
}
