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

/** Hand-built PBR maps give the broad stone surfaces slab scale, grain and mineral veining. */
function marbleCanvas(height = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  const r = rng(7);
  g.fillStyle = height ? '#818181' : '#e6dfd2';
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 320; i++) {
    const x = r() * 1024, y = r() * 1024;
    const rad = 18 + r() * 120;
    const v = (110 + r() * 48) | 0;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, height ? `rgba(${v},${v},${v},0.18)` : `rgba(151,139,120,0.10)`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 18; i++) {
    const alpha = 0.08 + r() * 0.18;
    g.strokeStyle = height ? `rgba(55,55,55,${alpha + 0.2})` : `rgba(105,94,79,${alpha})`;
    g.lineWidth = 0.7 + r() * 2.4;
    g.beginPath();
    let x = r() * 1024, y = r() * 1024;
    g.moveTo(x, y);
    for (let k = 0; k < 10; k++) {
      x += (r() - 0.44) * 150; y += (r() - 0.44) * 150;
      g.quadraticCurveTo(x + (r() - 0.5) * 85, y + (r() - 0.5) * 85, x, y);
    }
    g.stroke();
    if (!height && i % 3 === 0) {
      g.strokeStyle = `rgba(226,207,167,${alpha * 0.45})`;
      g.lineWidth *= 0.35;
      g.stroke();
    }
  }
  // Fine slab edge and softened bevel catch; the repeat reads as large cut stone, not noise.
  g.strokeStyle = height ? 'rgba(52,52,52,0.45)' : 'rgba(111,98,78,0.22)';
  g.lineWidth = 5;
  g.strokeRect(3, 3, 1018, 1018);
  g.strokeStyle = height ? 'rgba(220,220,220,0.22)' : 'rgba(255,255,255,0.38)';
  g.lineWidth = 2;
  g.strokeRect(8, 8, 1008, 1008);
  return c;
}

function woodCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d')!; const r = rng(31);
  g.fillStyle = '#75543a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const y = r() * 512; g.strokeStyle = `rgba(${r() > .5 ? '214,174,125' : '32,21,13'},${.035 + r() * .11})`;
    g.lineWidth = 1 + r() * 7; g.beginPath(); g.moveTo(0, y);
    g.bezierCurveTo(140, y + (r() - .5) * 60, 360, y + (r() - .5) * 60, 512, y + (r() - .5) * 60); g.stroke();
  }
  for (let i = 0; i < 6; i++) { const x = r() * 512, y = r() * 512; g.strokeStyle = 'rgba(35,23,13,.22)'; g.beginPath(); g.ellipse(x, y, 7 + r() * 15, 3 + r() * 7, r(), 0, Math.PI * 2); g.stroke(); }
  return c;
}

function tileCanvas(color: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d')!; const base = new THREE.Color(color);
  const rgb = `rgb(${(base.r * 205) | 0},${(base.g * 205) | 0},${(base.b * 205) | 0})`;
  g.fillStyle = rgb; g.fillRect(0, 0, 512, 512);
  const r = rng(color | 0);
  for (let y = 0; y < 512; y += 128) for (let x = 0; x < 512; x += 128) {
    const d = (r() - .5) * 14; g.fillStyle = `rgba(255,255,255,${.025 + r() * .04})`; g.fillRect(x + 2, y + 2, 122, 122);
    g.fillStyle = `rgba(0,0,0,${.035 + Math.abs(d) * .002})`; g.fillRect(x + 2, y + 124, 124, 3); g.fillRect(x + 124, y + 2, 3, 124);
  }
  return c;
}

function screenCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 512, 320);
  grad.addColorStop(0, '#182a35'); grad.addColorStop(.55, '#29495a'); grad.addColorStop(1, '#101a22');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#d7bf91'; g.fillRect(36, 38, 5, 238);
  g.fillStyle = '#f2eadb'; g.font = '600 27px Georgia, serif'; g.fillText('JOUMERA', 66, 88);
  g.fillStyle = '#b9c8ca'; g.font = '16px system-ui, sans-serif'; g.fillText('DESIGNED FOR LIVING', 67, 118);
  g.strokeStyle = 'rgba(231,207,163,.6)'; g.lineWidth = 2; g.beginPath();
  g.moveTo(66, 145); g.lineTo(446, 145); g.stroke();
  g.fillStyle = '#d6c29d'; g.fillRect(68, 174, 152, 90);
  g.fillStyle = '#738b8c'; g.fillRect(230, 174, 214, 90);
  g.fillStyle = 'rgba(255,255,255,.22)';
  for (let i = 0; i < 5; i++) g.fillRect(82 + i * 28, 187 + (i % 2) * 9, 17, 62 - (i % 2) * 10);
  g.fillStyle = '#d9c7a7'; g.fillRect(244, 187, 181, 7); g.fillRect(244, 203, 130, 4); g.fillRect(244, 215, 155, 4);
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
  const animatedDisplays: THREE.MeshBasicMaterial[] = [];
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const marbleBase = new THREE.CanvasTexture(marbleCanvas());
  marbleBase.colorSpace = THREE.SRGBColorSpace;
  marbleBase.wrapS = marbleBase.wrapT = THREE.RepeatWrapping;
  marbleBase.anisotropy = aniso;
  const marbleBumpBase = new THREE.CanvasTexture(marbleCanvas(true));
  marbleBumpBase.wrapS = marbleBumpBase.wrapT = THREE.RepeatWrapping;
  marbleBumpBase.anisotropy = aniso;
  const woodBase = new THREE.CanvasTexture(woodCanvas());
  woodBase.colorSpace = THREE.SRGBColorSpace;
  woodBase.wrapS = woodBase.wrapT = THREE.RepeatWrapping;
  woodBase.anisotropy = aniso;
  extraDispose.push(marbleBase, marbleBumpBase, woodBase);
  const marbleMat = (rx: number, rz: number) => {
    const tx = marbleBase.clone();
    const bump = marbleBumpBase.clone();
    tx.repeat.set(rx, rz);
    bump.repeat.set(rx, rz);
    tx.needsUpdate = true; bump.needsUpdate = true;
    extraDispose.push(tx, bump);
    return new THREE.MeshStandardMaterial({ map: tx, bumpMap: bump, bumpScale: 0.012, roughness: 0.29, metalness: 0.035 });
  };
  const storeFloorMat = (color: number) => {
    const tx = new THREE.CanvasTexture(tileCanvas(color));
    tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3, 3); tx.anisotropy = aniso;
    extraDispose.push(tx);
    return new THREE.MeshStandardMaterial({ map: tx, color: 0xffffff, roughness: 0.36, metalness: 0.035 });
  };

  const std = (color: number, roughness: number, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodBase, color: 0xffffff, roughness: 0.56, metalness: 0.025 });
  const brassMat = std(0xb99a69, 0.27, 0.82);
  const darkMetal = std(0x292724, 0.34, 0.72);
  const led = new THREE.MeshStandardMaterial({ color: 0xffe9c3, emissive: 0xffc979, emissiveIntensity: 1.5, roughness: 0.24 });
  const M = {
    wall: std(0xe8e1d5, 0.9),
    ceil: std(0xf0eadd, 0.92),
    dark: std(0x171615, 0.42, 0.38),
    gold: brassMat,
    wood: woodMat,
    stone: std(0xf0ece4, 0.3),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdce7e6, roughness: 0.08, metalness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.12, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
    glassTint: new THREE.MeshPhysicalMaterial({ color: 0xbacbc9, roughness: 0.11, metalness: 0.12, clearcoat: 0.75, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide }),
    frame: darkMetal,
    led,
    light: new THREE.MeshBasicMaterial({ color: 0xfff3dc }),
    leaf: std(0x304a3b, 0.72),
    leafLight: std(0x526c52, 0.7),
    pot: std(0x292725, 0.42, 0.35),
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
  const vaultPanel = (x0: number, x1: number, z0: number, z1: number) => {
    const segs = 12, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const roofY = (x: number) => 6.15 + 2.4 * (1 - (x / 8) ** 2);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, x = x0 + (x1 - x0) * t;
      positions.push(x, roofY(x), z0, x, roofY(x), z1);
      uvs.push(t, 0, t, 1);
      if (i < segs) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, M.glassTint);
    mesh.receiveShadow = true; group.add(mesh);
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
  // The atrium roof is a shallow barrel vault: bronze ribs, glazed bays and recessed warm light rails.
  for (let z = 9; z >= -31; z -= 10) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) { const x = -8 + i; pts.push(new THREE.Vector3(x, 6.15 + 2.4 * (1 - (x / 8) ** 2), z)); }
    const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.075, 8, false), brassMat);
    rib.castShadow = true; group.add(rib);
  }
  for (const z of [14, 4, -6, -16, -26]) {
    vaultPanel(-8, -3, z, z - 10); vaultPanel(-3, 3, z, z - 10); vaultPanel(3, 8, z, z - 10);
  }
  for (const x of [-6.8, -4, 0, 4, 6.8]) {
    const y = 6.15 + 2.4 * (1 - (x / 8) ** 2) - 0.12;
    const rail = box(x - 0.035, x + 0.035, y - 0.035, y + 0.035, -35.8, 11.8, M.led, false, false);
    rail.castShadow = false;
  }
  // Stone border courses and slim brass inlay lines lead the eye down the gallery.
  for (const x of [-7.6, -3.7, 3.7, 7.6]) box(x - 0.035, x + 0.035, 0.008, 0.018, -35.8, 11.8, brassMat, false, false);
  for (const z of [8, -4, -16, -28]) box(-19.7, 19.7, 0.008, 0.018, z - 0.025, z + 0.025, brassMat, false, false);
  // A compass medallion is inset into the marble at the centre of the long atrium.
  const medallion = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.72, 48), brassMat);
  medallion.rotation.x = -Math.PI / 2; medallion.position.set(0, 0.018, -12); group.add(medallion);
  const medallionCore = new THREE.Mesh(new THREE.CircleGeometry(1.42, 48), marbleMat(1, 1));
  medallionCore.rotation.x = -Math.PI / 2; medallionCore.position.set(0, 0.015, -12); group.add(medallionCore);

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
  const shaftGeo = new THREE.CylinderGeometry(0.27, 0.37, 5.9, 32, 1);
  const shafts = new THREE.InstancedMesh(shaftGeo, M.stone, COLZ.length * 2);
  const bases = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.47, 0.52, 0.28, 32), brassMat, COLZ.length * 2);
  const capitals = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.46, 0.32, 0.32, 32), brassMat, COLZ.length * 2);
  const dummy = new THREE.Object3D();
  let ci = 0;
  for (const s of [-1, 1]) for (const z of COLZ) {
    dummy.position.set(s * 6, 3.22, z);
    dummy.updateMatrix();
    shafts.setMatrixAt(ci++, dummy.matrix);
    colliders.push({ minX: s * 6 - 0.34, maxX: s * 6 + 0.34, minZ: z - 0.34, maxZ: z + 0.34 });
    dummy.position.set(s * 6, 0.14, z); dummy.updateMatrix(); bases.setMatrixAt(ci - 1, dummy.matrix);
    dummy.position.set(s * 6, 6.1, z); dummy.updateMatrix(); capitals.setMatrixAt(ci - 1, dummy.matrix);
  }
  shafts.castShadow = bases.castShadow = capitals.castShadow = true;
  shafts.receiveShadow = bases.receiveShadow = capitals.receiveShadow = true;
  group.add(shafts, bases, capitals);

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
      // Bronze storefront portal, glazed display wings and an unobstructed 3 m entrance.
      box(sx0 - 0.045, sx1 + 0.045, 0, 0.12, zf, zn, M.frame, false, false);
      box(sx0 - 0.045, sx1 + 0.045, 3.54, 3.68, zf, zn, M.frame, false, false);
      box(sx0 - 0.045, sx1 + 0.045, 3.65, 3.73, zf, zn, M.led, false, false);
      box(mid - 0.08, mid + 0.08, 0.1, 3.6, st.zc - 1.52, st.zc - 1.43, brassMat, false, false);
      box(mid - 0.08, mid + 0.08, 0.1, 3.6, st.zc + 1.43, st.zc + 1.52, brassMat, false, false);
      for (const z of [st.zc - 4.7, st.zc - 2.8, st.zc + 2.8, st.zc + 4.7]) {
        box(mid - 0.045, mid + 0.045, 0.12, 3.5, z - 0.035, z + 0.035, M.frame, false, false);
      }
      // Open glass entry remains traversable; the side panes have clear divisions and kick plates.
      for (const [d0, d1] of [[st.zc - 1.42, st.zc - 0.72], [st.zc + 0.72, st.zc + 1.42]]) {
        box(mid - 0.04, mid + 0.04, 0.12, 0.48, d0, d1, M.frame, false, false);
        box(mid - 0.04, mid + 0.04, 0.48, 3.35, d0, d1, M.glass, false, false);
      }
      box(mid - 0.065, mid + 0.065, 0.7, 2.35, st.zc - 0.72, st.zc - 0.65, brassMat, false, false);
      box(mid - 0.065, mid + 0.065, 0.7, 2.35, st.zc + 0.65, st.zc + 0.72, brassMat, false, false);
      // Door header and a slim threshold create a readable shop entrance without blocking movement.
      box(mid - 0.13, mid + 0.13, 3.58, 3.73, st.zc - 1.5, st.zc + 1.5, brassMat, false, false);
      box(mid - 0.2, mid + 0.2, 0.02, 0.065, st.zc - 1.45, st.zc + 1.45, brassMat, false, false);
      const signBacking = box(sx0 - 0.06, sx1 + 0.06, 4.05, 5.75, st.zc - 3.5, st.zc + 3.5, M.dark, false, false);
      signBacking.castShadow = false;
      const sign = label(st.name, 6.4, 1.12, '#f4d9a7', null, 10);
      sign.position.set(s * 8.01, 4.88, st.zc);
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
    plane(fx0, fx1, zf, zn, 0.006, storeFloorMat(st.floor));
    box(fx0, fx1, 3.6, 3.7, zf, zn, M.ceil);
    const [bx0, bx1] = rx(19.96, 20);
    box(bx0, bx1, 0, 3.6, zf, zn, std(st.accent, 0.56));
    // A fluted feature wall, bronze rails and halo-lit brand panel give each boutique a distinct back wall.
    const [fl0, fl1] = rx(19.82, 19.88);
    for (let z = zf + 0.35; z < zn; z += 0.34) box(fl0, fl1, 0.18, 3.45, z, z + 0.035, brassMat, false, false);
    const signBase = box(bx0 - 0.025, bx1 + 0.02, 2.45, 3.52, st.zc - 3.1, st.zc + 3.1, M.dark, false, false);
    signBase.castShadow = false;
    const sign = label(st.name, 5.5, 0.88, '#f4d9a7', null, 14);
    sign.position.set(s * 19.93, 2.9, st.zc);
    sign.rotation.y = -s * Math.PI / 2;
    for (const off of [-2, 2]) {
      const [lx0, lx1] = rx(12, 13);
      box(lx0, lx1, 3.54, 3.6, st.zc + off - 2.5, st.zc + off + 2.5, M.light, false, false);
    }
    const lamp = new THREE.PointLight(0xffe5c3, 17, 18, 2);
    lamp.position.set(s * 14, 3.2, st.zc);
    group.add(lamp);
    for (const z of [st.zc - 4.65, st.zc + 4.65]) {
      const strip = box(...rx(9, 19.6), 3.48, 3.53, z - 0.025, z + 0.025, M.led, false, false);
      strip.castShadow = false;
    }
    if (st.id === 'tech-studio') {
      // Powered-off reflective display screens and a brushed-metal demo wall.
      for (const z of [st.zc - 3.2, st.zc, st.zc + 3.2]) {
        const frame = box(...rx(18.55, 18.7), 1.7, 3.15, z - 1.15, z + 1.15, M.frame, false, false);
        frame.castShadow = false;
        const screenTexture = new THREE.CanvasTexture(screenCanvas());
        screenTexture.colorSpace = THREE.SRGBColorSpace; screenTexture.anisotropy = aniso; extraDispose.push(screenTexture);
        const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false });
        animatedDisplays.push(screenMaterial);
        const display = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.18), screenMaterial);
        display.position.set(s * 18.52, 2.43, z); display.rotation.y = -s * Math.PI / 2; group.add(display);
        const glow = box(...rx(18.48, 18.5), 1.73, 1.78, z - 0.88, z + 0.88, M.led, false, false); glow.castShadow = false;
      }
    } else if (st.id === 'home-gallery') {
      // A quiet interior lounge vignette with rounded forms and warm wood.
      for (const z of [st.zc - 2.65, st.zc + 2.65]) {
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(.52, .58, .42, 32), woodMat);
        stool.position.set(s * 10.8, .22, z); stool.castShadow = stool.receiveShadow = true; group.add(stool);
        const cushion = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .12, 32), M.stone);
        cushion.position.set(s * 10.8, .49, z); cushion.castShadow = true; group.add(cushion);
      }
      const vaseGeo = new THREE.LatheGeometry([[0,0],[.14,0],[.24,.1],[.21,.42],[.12,.62],[.13,.78]].map(([x,y]) => new THREE.Vector2(x,y)), 32);
      const feature = new THREE.Mesh(vaseGeo, std(0xd9cbb7, .24));
      feature.position.set(s * 11.3, .56, st.zc); feature.scale.setScalar(1.15); feature.castShadow = true; group.add(feature);
    } else if (st.id === 'style-lab') {
      // Slim garment rails with a rhythm of draped, tapered fabric forms.
      for (const z of [st.zc - 2.5, st.zc + 2.5]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 3.5, 12), brassMat);
        rail.rotation.z = Math.PI / 2; rail.position.set(s * 11.3, 1.95, z); rail.castShadow = true; group.add(rail);
        for (let j = 0; j < 5; j++) {
          const hanger = new THREE.Mesh(new THREE.TorusGeometry(.13, .012, 6, 16, Math.PI), darkMetal);
          hanger.rotation.set(0, Math.PI / 2, 0); hanger.position.set(s * (10.1 + j * .48), 1.77, z); group.add(hanger);
          const textile = new THREE.Mesh(new THREE.CapsuleGeometry(.13, .38, 3, 8), std([0x794c58, 0x9b846a, 0x3e4048, 0x73655b, 0x4d635d][j], .78));
          textile.scale.set(.85, 1, .22); textile.position.set(s * (10.1 + j * .48), 1.35, z); textile.castShadow = true; group.add(textile);
        }
      }
    } else if (st.id === 'smart-living') {
      // Circular light installation and floating ledges for connected-home devices.
      for (const z of [st.zc - 2.1, st.zc + 2.1]) {
        const halo = new THREE.Mesh(new THREE.TorusGeometry(.72, .035, 8, 48), led);
        halo.position.set(s * 18.7, 2.15, z); halo.rotation.y = -s * Math.PI / 2; group.add(halo);
        const shelf = box(...rx(16.4, 18.2), 1.08, 1.15, z - .55, z + .55, woodMat, false, false);
        shelf.castShadow = true;
      }
    } else if (st.id === 'beauty-atelier') {
      // Warm vanity mirrors, soft luminous surrounds and marble consultation counters.
      for (const z of [st.zc - 2.45, st.zc + 2.45]) {
        const mirrorBack = new THREE.Mesh(new THREE.CircleGeometry(.62, 40), std(0xc3d1ce, .1, .22));
        mirrorBack.position.set(s * 19.78, 2.2, z); mirrorBack.rotation.y = -s * Math.PI / 2; group.add(mirrorBack);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(.68, .045, 8, 48), led);
        halo.position.set(s * 19.72, 2.2, z); halo.rotation.y = -s * Math.PI / 2; group.add(halo);
      }
    }

    // shelving with instanced decor items
    const [sh0, sh1] = rx(18.9, 19.9);
    colliders.push({ minX: sh0, maxX: sh1, minZ: st.zc - 4, maxZ: st.zc + 4 });
    const levels = [0.48, 1.12, 1.76, 2.4, 3.04];
    for (const lv of levels) {
      const plank = box(sh0, sh1, lv, lv + 0.055, st.zc - 4, st.zc + 4, woodMat, false);
      plank.castShadow = true;
      box(sh0 + 0.02, sh0 + 0.07, lv, lv + 0.045, st.zc - 4, st.zc + 4, brassMat, false, false);
    }
    for (const z of [-4, 0, 4]) box(sh0, sh1, 0, 3.1, st.zc + z - 0.045, st.zc + z + 0.045, darkMetal, false);
    // Low-poly merchandise silhouettes are instanced by product form, not repeated coloured cubes.
    const vasePts = [[0, 0], [.08, 0], [.12, .1], [.1, .22], [.065, .3], [.05, .4], [.075, .43]].map(([x, y]) => new THREE.Vector2(x, y));
    const forms: Record<string, THREE.BufferGeometry> = {
      laptop: new THREE.BoxGeometry(.42, .035, .3),
      speaker: new THREE.CylinderGeometry(.095, .105, .3, 24),
      vase: new THREE.LatheGeometry(vasePts, 24),
      bottle: new THREE.CylinderGeometry(.052, .06, .22, 20),
      bag: new THREE.BoxGeometry(.34, .29, .14),
      lamp: new THREE.ConeGeometry(.14, .23, 24, 1, true),
    };
    for (const shape of new Set(st.products.map((p) => p.shape))) {
      const ps = st.products.filter((p) => p.shape === shape);
      const count = levels.length * 3;
      const items = new THREE.InstancedMesh(forms[shape], new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: shape === 'vase' || shape === 'bottle' ? .26 : .39, metalness: shape === 'laptop' ? .5 : .12, envMapIntensity: .65 }), count);
      let k = 0;
      for (const lv of levels) for (let j = 0; j < 3; j++) {
        const p = ps[(k + j) % ps.length];
        const h = shape === 'vase' ? .42 : shape === 'speaker' ? .3 : shape === 'laptop' ? .07 : shape === 'bag' ? .3 : .22;
        dummy.position.set(s * 19.12, lv + .06 + h * .5, st.zc - 3.1 + j * 2.05);
        dummy.scale.set(1, shape === 'vase' ? .9 : 1, 1);
        dummy.rotation.set(0, shape === 'laptop' ? -.16 : (j % 2) * .12, 0);
        dummy.updateMatrix(); items.setMatrixAt(k, dummy.matrix);
        items.setColorAt(k, new THREE.Color(p.color)); k++;
      }
      items.castShadow = true; items.receiveShadow = true; group.add(items);
    }

    // display table
    const islandBase = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.25, .72, 48), M.dark);
    islandBase.scale.x = .36; islandBase.position.set(s * 14, .38, st.zc); islandBase.castShadow = islandBase.receiveShadow = true; group.add(islandBase);
    const islandTop = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, .08, 48), M.stone);
    islandTop.scale.x = .36; islandTop.position.set(s * 14, .78, st.zc); islandTop.castShadow = islandTop.receiveShadow = true; group.add(islandTop);
    const [t0, t1] = rx(13.35, 14.65);
    colliders.push({ minX: t0, maxX: t1, minZ: st.zc - 3.55, maxZ: st.zc + 3.55 });
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
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * sc, 0.28 * sc, 0.55 * sc, 32), M.pot);
    pot.position.set(x, 0.275 * sc, z);
    pot.castShadow = true;
    group.add(pot);
    const rr = rng(Math.floor(x * 13 + z * 7));
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(.29 * sc, .29 * sc, .035 * sc, 32), darkMetal);
    soil.position.set(x, .55 * sc, z); group.add(soil);
    const foliage = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), M.leaf, 15);
    const leafTransform = new THREE.Object3D();
    for (let i = 0; i < 15; i++) {
      const angle = rr() * Math.PI * 2;
      const reach = (.22 + rr() * .44) * sc;
      leafTransform.scale.set(.13 * sc, (.42 + rr() * .35) * sc, .09 * sc);
      leafTransform.position.set(x + Math.cos(angle) * reach * .55, (.78 + rr() * 1.25) * sc, z + Math.sin(angle) * reach * .55);
      leafTransform.rotation.set(Math.sin(angle) * .56, angle, Math.cos(angle) * -.56);
      leafTransform.updateMatrix(); foliage.setMatrixAt(i, leafTransform.matrix);
      foliage.setColorAt(i, new THREE.Color(i % 3 ? 0x304a3b : 0x526c52));
    }
    foliage.castShadow = true; foliage.receiveShadow = false; group.add(foliage);
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
  // Slatted oak-and-bronze benches, sized as practical seating and kept clear of the walking lane.
  for (const s of [-1, 1]) for (const z of [-5, -11, -23]) {
    const x = s * 2.6;
    for (let k = 0; k < 5; k++) box(x - .26, x + .26, .43, .49, z - .88 + k * .36, z - .67 + k * .36, M.wood, false);
    for (const zz of [z - .62, z + .62]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.07, .43, .07), brassMat);
      leg.position.set(x, .215, zz); leg.castShadow = true; group.add(leg);
    }
    for (let k = 0; k < 4; k++) box(x - .24, x + .24, .52 + k * .31, .58 + k * .31, z + .68, z + .9, M.wood, false);
    colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.9, maxZ: z + 0.9 });
  }

  return {
    group, colliders, pickables, sun,
    update(t: number) {
      pickables.forEach((p, i) => { p.obj.rotation.y = t * 0.45 + i; });
      animatedDisplays.forEach((m, i) => { m.opacity = .94 + Math.sin(t * .7 + i) * .035; });
    },
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
