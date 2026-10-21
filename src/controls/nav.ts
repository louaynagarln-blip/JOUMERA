import { clearWalkSegment, type Box } from './collision';

export interface Pt { x: number; z: number }
interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }

/** Grid A* over the walkable floor, used for "walk me to this store". */
export class NavGrid {
  private readonly cs = 0.4;
  private readonly w: number;
  private readonly h: number;
  private readonly blocked: Uint8Array;
  private readonly b: Bounds;
  private readonly boxes: Box[];
  private readonly bodyRadius: number;

  constructor(boxes: Box[], bounds: Bounds, radius = 0.45, bodyRadius = 0.3) {
    if (!(bodyRadius > 0 && radius >= bodyRadius)) throw new Error('Invalid navigation clearance');
    this.boxes = boxes.map(b => ({ ...b }));
    this.bodyRadius = bodyRadius;
    const b = bounds;
    this.b = bounds;
    this.w = Math.ceil((b.maxX - b.minX) / this.cs);
    this.h = Math.ceil((b.maxZ - b.minZ) / this.cs);
    this.blocked = new Uint8Array(this.w * this.h);
    for (const bx of boxes) {
      const i0 = Math.max(0, Math.floor((bx.minX - radius - b.minX) / this.cs));
      const i1 = Math.min(this.w - 1, Math.ceil((bx.maxX + radius - b.minX) / this.cs));
      const j0 = Math.max(0, Math.floor((bx.minZ - radius - b.minZ) / this.cs));
      const j1 = Math.min(this.h - 1, Math.ceil((bx.maxZ + radius - b.minZ) / this.cs));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const cx = b.minX + (i + 0.5) * this.cs;
          const cz = b.minZ + (j + 0.5) * this.cs;
          const dx = cx - Math.max(bx.minX, Math.min(cx, bx.maxX));
          const dz = cz - Math.max(bx.minZ, Math.min(cz, bx.maxZ));
          if (dx * dx + dz * dz < radius * radius) this.blocked[j * this.w + i] = 1;
        }
      }
    }
  }

  private cell(x: number, z: number): [number, number] {
    const i = Math.min(this.w - 1, Math.max(0, Math.floor((x - this.b.minX) / this.cs)));
    const j = Math.min(this.h - 1, Math.max(0, Math.floor((z - this.b.minZ) / this.cs)));
    return [i, j];
  }
  private center(i: number, j: number): Pt {
    return { x: this.b.minX + (i + 0.5) * this.cs, z: this.b.minZ + (j + 0.5) * this.cs };
  }
  private free(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.blocked[j * this.w + i] === 0;
  }
  isFree(x: number, z: number): boolean { if (x < this.b.minX || x >= this.b.maxX || z < this.b.minZ || z >= this.b.maxZ) return false; const [i, j] = this.cell(x, z); return this.free(i, j); }

  private nearestReachable(point: Pt): [number, number] | null {
    const [i, j] = this.cell(point.x, point.z);
    const candidates: Array<{ cell: [number, number]; distance: number }> = [];
    // Escape only the navigation margin, never teleport or search through a wall.
    for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
      if (!this.free(i + di, j + dj)) continue;
      const p = this.center(i + di, j + dj);
      candidates.push({ cell: [i + di, j + dj], distance: Math.hypot(p.x - point.x, p.z - point.z) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.find(c => c.distance <= 1.6 && clearWalkSegment(point, this.center(...c.cell), this.bodyRadius, this.boxes))?.cell ?? null;
  }

  private los(a: Pt, c: Pt): boolean {
    if (!clearWalkSegment(a, c, this.bodyRadius, this.boxes)) return false;
    const d = Math.hypot(c.x - a.x, c.z - a.z);
    const n = Math.max(1, Math.ceil(d / 0.2));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (!this.isFree(a.x + (c.x - a.x) * t, a.z + (c.z - a.z) * t)) return false;
    }
    return true;
  }

  findPath(sx: number, sz: number, gx: number, gz: number): Pt[] | null {
    const start = { x: sx, z: sz }, goal = { x: gx, z: gz };
    const inside = (p: Pt) => p.x >= this.b.minX && p.x < this.b.maxX && p.z >= this.b.minZ && p.z < this.b.maxZ;
    if (![sx, sz, gx, gz].every(Number.isFinite) || !inside(start) || !inside(goal)) return null;
    if (!clearWalkSegment(start, start, this.bodyRadius, this.boxes) || !clearWalkSegment(goal, goal, this.bodyRadius, this.boxes)) return null;
    if (this.isFree(gx, gz) && this.los({x: sx,z: sz}, {x: gx,z: gz})) return [{x: gx,z: gz}];
    const s = this.nearestReachable(start);
    const g = this.nearestReachable(goal);
    if (!s || !g) return null;
    const W = this.w;
    const N = W * this.h;
    const gScore = new Float32Array(N).fill(Infinity);
    const parent = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap: Array<[number, number]> = [];
    const push = (f: number, id: number) => {
      heap.push([f, id]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const pop = (): number => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1, r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top[1];
    };
    const sid = s[1] * W + s[0];
    const gid = g[1] * W + g[0];
    const hfn = (id: number) => Math.hypot((id % W) - g[0], Math.floor(id / W) - g[1]);
    gScore[sid] = 0;
    push(hfn(sid), sid);
    let found = false;
    while (heap.length) {
      const cur = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === gid) { found = true; break; }
      const ci = cur % W, cj = Math.floor(cur / W);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (!this.free(ni, nj)) continue;
          if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
          const nid = nj * W + ni;
          const ng = gScore[cur] + (di && dj ? 1.4142 : 1);
          if (ng < gScore[nid]) {
            gScore[nid] = ng;
            parent[nid] = cur;
            push(ng + hfn(nid), nid);
          }
        }
      }
    }
    if (!found) return null;
    const cells: Pt[] = [];
    for (let id = gid; id !== -1; id = parent[id]) cells.push(this.center(id % W, Math.floor(id / W)));
    cells.reverse();
    cells.unshift(start);
    cells.push(goal);
    const out: Pt[] = [];
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !this.los(cells[i], cells[j])) j--;
      out.push(cells[j]);
      i = j;
    }

    return out;
  }
}
