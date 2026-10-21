import * as THREE from 'three';
import type { Box } from '../controls/collision';
import { STORES, type Product, type StoreDef } from '../data/catalog';
import { makeProductMesh } from './productMesh';

export const BOUNDS = { minX: -20, maxX: 20, minZ: -36, maxZ: 12 };
export interface Pickable { product: Product; obj: THREE.Object3D; pos: THREE.Vector3 }
export interface Mall {
  group: THREE.Group;
  colliders: Box[];
  pickables: Pickable[];
  sun: THREE.DirectionalLight;
  update(t: number): void;
  dispose(): void;
}
export const STAGES = 4;

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** PROCEDURAL marble stand-in. Replace with scanned PBR marble (see assets manifest). */
function marbleCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  const r = rng(7);
  g.fillStyle = '#e9e4da';
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${(150 + r() * 80) | 0},${(145 + r() * 80) | 0},${(135 + r() * 80) | 0},0.05)`;
    g.fillRect(r() * 1024, r() * 1024, r() * 40 + 4, r() * 40 + 4);
  }
  for (let i = 0; i < 24; i++) {
    g.strokeStyle = `rgba(90,85,80,${0.05 + r() * 0.16})`;
    g.lineWidth = 0.5 + r() * 2;
    g.beginPath();
    let x = r() * 1024, y = r() * 1024;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (r() - 0.5) * 300; y += (r() - 0.3) * 300;
      g.quadraticCurveTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 120, x, y);
    }
    g.stroke();
  }
  g.strokeStyle = 'rgba(110,104,95,0.55)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 1024, 1024);
  return c;
}

export async function buildMall(
  renderer: THREE.WebGLRenderer,
  onStage: (i: number, total: number, label: string) => Promise<void>,
): Promise<Mall> {
  const group = new THREE.Group();
  const colliders: Box[] = [];
  const pickables: Pickable[] = [];
  const extraDispose: Array<{ dispose(): void }> = [];
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const marbleBase = new THREE.CanvasTexture(marbleCanvas());
  marbleBase.colorSpace = THREE.SRGBColorSpace;
  marbleBase.wrapS = marbleBase.wrapT = THREE.RepeatWrapping;
  marbleBase.anisotropy = aniso;
  extraDispose.push(marbleBase);
  const marbleMat = (rx: number, rz: number) => {
    const tx = marbleBase.clone();
    tx.repeat.set(rx, rz);
    tx.needsUpdate = true;
    extraDispose.push(tx);
    return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.2, metalness: 0.05 });
  };

  const std = (color: number, roughness: number, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const M = {
    wall: std(0xe9e4da, 0.85),
    ceil: std(0xf3efe7, 0.95),
    dark: std(0x1a1816, 0.5, 0.5),
    gold: std(0xc9ad7e, 0.28, 1),
    wood: std(0x7a5a3e, 0.6),
    stone: std(0xf0ece4, 0.3),
    glass: new THREE.MeshStandardMaterial({ color: 0xdfe9ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false }),
    light: new THREE.MeshBasicMaterial({ color: 0xfff3dc }),
    leaf: std(0x3d5a3a, 0.8),
    pot: std(0x2c2a27, 0.5, 0.3),
  };

  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material, collide = false, cast = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    if (collide) colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
    return m;
  };
  const plane = (x0: number, x1: number, z0: number, z1: number, y: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
  };
  const label = (text: string, w: number, h: number, fg: string, bg: string | null, spacing = 10) => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = Math.max(64, Math.round((1024 * h) / w));
    const g = c.getContext('2d')!;
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    (g as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
    let size = c.height * 0.55;
    g.font = `600 ${size}px Georgia, "Times New Roman", serif`;
    while (g.measureText(text).width > c.width * 0.92 && size > 20) { size -= 4; g.font = `600 ${size}px Georgia, "Times New Roman", serif`; }
    g.fillText(text, c.width / 2, c.height / 2 + size * 0.04);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = aniso;
    extraDispose.push(tx);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx, transparent: !bg, toneMapped: false }));
    group.add(mesh);
    return mesh;
  };

  // ---------- Stage 1: hall shell ----------
  await onStage(1, STAGES, 'Architecture');
  plane(-20, 20, -36, 12, 0, marbleMat(20, 24));
  const hallCeil = new THREE.Mesh(new THREE.PlaneGeometry(16, 48), M.ceil);
  hallCeil.rotation.x = Math.PI / 2;
  hallCeil.position.set(0, 6, -12);
  group.add(hallCeil); // deliberately not a shadow caster: acts as a skylight for the sun light
  for (const z of [8, -2, -12, -22, -32]) for (const x of [-4.5, 0, 4.5]) box(x - 0.6, x + 0.6, 5.94, 5.99, z - 2.5, z + 2.5, M.light, false, false);

  box(-20, -4, 0, 6, 12, 12.3, M.wall, true);
  box(4, 20, 0, 6, 12, 12.3, M.wall, true);
  box(-4, 4, 4.2, 6, 12, 12.3, M.wall);
  box(-4, 4, 0, 4.2, 12.1, 12.15, M.glass, true, false);
  box(-4, 4, 4.1, 4.2, 12.0, 12.35, M.gold, false, false);
  box(-20, 20, 0, 6, -36.3, -36, M.wall, true);
  box(-20.3, -20, 0, 6, -36.3, 12.3, M.wall, true);
  box(20, 20.3, 0, 6, -36.3, 12.3, M.wall, true);
  box(-7, 7, 1.6, 5.8, -36, -35.96, M.dark);
  label('JOUMERA', 12, 2.2, '#d8c299', null, 28).position.set(0, 3.9, -35.94);
  label('V-MALL', 4, 0.6, '#f6f1e9', null, 18).position.set(0, 2.5, -35.94);

  const COLZ = [4, -5, -11, -17, -23, -29];
  const shaftGeo = new THREE.CylinderGeometry(0.32, 0.32, 6, 24);
  const shafts = new THREE.InstancedMesh(shaftGeo, M.stone, COLZ.length * 2);
  const dummy = new THREE.Object3D();
  let ci = 0;
  for (const s of [-1, 1]) for (const z of COLZ) {
    dummy.position.set(s * 6, 3, z);
    dummy.updateMatrix();
    shafts.setMatrixAt(ci++, dummy.matrix);
    colliders.push({ minX: s * 6 - 0.34, maxX: s * 6 + 0.34, minZ: z - 0.34, maxZ: z + 0.34 });
    box(s * 6 - 0.4, s * 6 + 0.4, 0, 0.25, z - 0.4, z + 0.4, M.gold, false, false);
    box(s * 6 - 0.4, s * 6 + 0.4, 5.75, 6, z - 0.4, z + 0.4, M.gold, false, false);
  }
  shafts.castShadow = true;
  shafts.receiveShadow = true;
  group.add(shafts);

  // ---------- Stage 2: storefronts ----------
  await onStage(2, STAGES, 'Storefronts');
  for (const s of [-1, 1] as const) {
    const sx0 = s > 0 ? 8 : -8.25;
    const sx1 = s > 0 ? 8.25 : -8;
    const mid = (sx0 + sx1) / 2;
    const list = STORES.filter((st) => st.side === s).sort((a, b) => b.zc - a.zc);
    let cursor = 12;
    for (const st of list) {
      const zn = st.zc + 5, zf = st.zc - 5;
      if (cursor > zn) box(sx0, sx1, 0, 6, zn, cursor, M.wall, true);
      box(mid - 0.03, mid + 0.03, 0, 3.6, st.zc + 1.5, zn, M.glass, true, false);
      box(mid - 0.03, mid + 0.03, 0, 3.6, zf, st.zc - 1.5, M.glass, true, false);
      box(sx0, sx1, 3.6, 6, zf, zn, M.wall);
      box(sx0 - 0.01, sx1 + 0.01, 3.5, 3.6, zf, zn, M.gold, false, false);
      box(mid - 0.06, mid + 0.06, 0, 3.6, st.zc - 1.55, st.zc - 1.45, M.gold, false, false);
      box(mid - 0.06, mid + 0.06, 0, 3.6, st.zc + 1.45, st.zc + 1.55, M.gold, false, false);
      const sign = label(st.name, 7, 1.3, '#d8c299', '#14110f', 8);
      sign.position.set(s * 7.98, 4.8, st.zc);
      sign.rotation.y = -s * Math.PI / 2;
      cursor = zf;
    }
    if (cursor > -36) box(sx0, sx1, 0, 6, -36, cursor, M.wall, true);
  }

  // ---------- Stage 3: store interiors + products ----------
  await onStage(3, STAGES, 'Store interiors');
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.3);
  sun.position.set(8, 24, 10);
  sun.target.position.set(0, 0, -12);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight(0xfff6e8, 0x8a8277, 0.35));

  const buildStore = (st: StoreDef) => {
    const s = st.side;
    const rx = (a: number, b: number): [number, number] => [Math.min(s * a, s * b), Math.max(s * a, s * b)];
    const [fx0, fx1] = rx(8.25, 20);
    const zn = st.zc + 5, zf = st.zc - 5;
    box(fx0, fx1, 0, 6, zn, zn + 0.2, M.wall, true);
    box(fx0, fx1, 0, 6, zf - 0.2, zf, M.wall, true);
    plane(fx0, fx1, zf, zn, 0.006, std(st.floor, 0.4, 0.05));
    box(fx0, fx1, 3.6, 3.7, zf, zn, M.ceil);
    const [bx0, bx1] = rx(19.96, 20);
    box(bx0, bx1, 0, 3.6, zf, zn, std(st.accent, 0.7));
    const sign = label(st.name, 6, 1.1, '#f6f1e9', null, 12);
    sign.position.set(s * 19.93, 2.9, st.zc);
    sign.rotation.y = -s * Math.PI / 2;
    for (const off of [-2, 2]) {
      const [lx0, lx1] = rx(12, 13);
      box(lx0, lx1, 3.54, 3.6, st.zc + off - 2.5, st.zc + off + 2.5, M.light, false, false);
    }
    const lamp = new THREE.PointLight(0xfff0d8, 22, 20, 2);
    lamp.position.set(s * 14, 3.2, st.zc);
    group.add(lamp);

    // shelving with instanced decor items
    const [sh0, sh1] = rx(18.9, 19.9);
    colliders.push({ minX: sh0, maxX: sh1, minZ: st.zc - 4, maxZ: st.zc + 4 });
    const levels = [0.45, 1.0, 1.55, 2.1, 2.65];
    for (const lv of levels) box(sh0, sh1, lv, lv + 0.04, st.zc - 4, st.zc + 4, M.wood, false);
    for (const z of [-4, 0, 4]) box(sh0, sh1, 0, 2.7, st.zc + z - 0.03, st.zc + z + 0.03, M.wood, false);
    const per = 11;
    const decor = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.3, 0.2), std(0xffffff, 0.55, 0.1), levels.length * per);
    const r = rng(st.zc * 31 + 5);
    const col = new THREE.Color();
    let k = 0;
    for (const lv of levels) for (let j = 0; j < per; j++) {
      const h = 0.5 + r() * 0.7;
      dummy.position.set(s * 19.4, lv + 0.04 + 0.15 * h, st.zc - 3.7 + j * 0.74);
      dummy.scale.set(0.7 + r() * 0.5, h, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      decor.setMatrixAt(k, dummy.matrix);
      col.setHex(st.accent).offsetHSL(0, (r() - 0.5) * 0.1, (r() - 0.3) * 0.35);
      decor.setColorAt(k++, col);
    }
    dummy.scale.set(1, 1, 1);
    decor.castShadow = true;
    group.add(decor);

    // display table
    const [t0, t1] = rx(13.4, 14.6);
    box(t0, t1, 0, 0.8, st.zc - 3.6, st.zc + 3.6, M.dark, true);
    const [tp0, tp1] = rx(13.3, 14.7);
    box(tp0, tp1, 0.8, 0.86, st.zc - 3.7, st.zc + 3.7, M.stone, false);
    // counter
    const [c0, c1] = rx(10, 10.8);
    box(c0, c1, 0, 1.05, st.zc + 2.9, st.zc + 4.8, M.dark, true);
    box(c0 - 0.02, c1 + 0.02, 1.05, 1.09, st.zc + 2.88, st.zc + 4.82, M.gold, false);

    st.products.forEach((p, i) => {
      const obj = makeProductMesh(p);
      const z = st.zc - 2.7 + i * 1.8;
      obj.position.set(s * 14, 0.86, z);
      obj.scale.setScalar(1.5);
      group.add(obj);
      pickables.push({ product: p, obj, pos: new THREE.Vector3(s * 14, 1.1, z) });
    });
  };
  STORES.forEach(buildStore);

  // ---------- Stage 4: hall furniture ----------
  await onStage(4, STAGES, 'Furnishing');
  const plant = (x: number, z: number, sc: number) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * sc, 0.28 * sc, 0.55 * sc, 24), M.pot);
    pot.position.set(x, 0.275 * sc, z);
    pot.castShadow = true;
    group.add(pot);
    const rr = rng(Math.floor(x * 13 + z * 7));
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry((0.35 + rr() * 0.2) * sc, 1), M.leaf);
      leaf.position.set(x + (rr() - 0.5) * 0.4 * sc, (1.0 + i * 0.35) * sc, z + (rr() - 0.5) * 0.4 * sc);
      leaf.castShadow = true;
      group.add(leaf);
    }
    colliders.push({ minX: x - 0.4 * sc, maxX: x + 0.4 * sc, minZ: z - 0.4 * sc, maxZ: z + 0.4 * sc });
  };
  for (const s of [-1, 1]) { plant(s * 7.2, 9, 1.3); plant(s * 7.2, -33, 1.3); }
  // central island
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 40), marbleMat(1, 1));
  ring.position.set(0, 0.25, -17);
  ring.castShadow = ring.receiveShadow = true;
  group.add(ring);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.03, 8, 48), M.gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.5, -17);
  group.add(rim);
  colliders.push({ minX: -1.6, maxX: 1.6, minZ: -18.6, maxZ: -15.4 });
  plant(0, -17, 1.8);
  // benches
  for (const s of [-1, 1]) for (const z of [-5, -11, -23]) {
    const x = s * 2.6;
    box(x - 0.25, x + 0.25, 0.4, 0.48, z - 0.9, z + 0.9, M.wood, false);
    box(x - 0.2, x + 0.2, 0, 0.4, z - 0.8, z + 0.8, M.dark, false);
    colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.9, maxZ: z + 0.9 });
  }

  return {
    group, colliders, pickables, sun,
    update(t: number) { pickables.forEach((p, i) => { p.obj.rotation.y = t * 0.45 + i; }); },
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
        }
      });
      extraDispose.forEach((d) => d.dispose());
    },
  };
}
