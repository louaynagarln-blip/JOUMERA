import * as THREE from 'three';
import {retailCounter} from './retailFixtures';
import type { Box } from '../controls/collision';
import { STORES, type Product, type StoreDef } from '../data/catalog';
import { Furnishings, disposeObject, batchArchitecture, ASSETS, type AssetName } from './assets';

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
export const STAGES = 13;

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

  const furnishings = new Furnishings();
  await furnishings.load(async (done) => onStage(done, STAGES, `Loading licensed models ${done}/9`));
  const loader = new THREE.TextureLoader();
  const [marbleBase, marbleNormal, marbleRough] = await Promise.all([
    loader.loadAsync('/assets/materials/marble_Diffuse.jpg'),
    loader.loadAsync('/assets/materials/marble_nor_gl.jpg'),
    loader.loadAsync('/assets/materials/marble_Rough.jpg'),
  ]);
  marbleBase.colorSpace = THREE.SRGBColorSpace;
  for (const tx of [marbleBase, marbleNormal, marbleRough]) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = aniso; }
  const woodBase = new THREE.CanvasTexture(woodCanvas());
  woodBase.colorSpace = THREE.SRGBColorSpace;
  woodBase.wrapS = woodBase.wrapT = THREE.RepeatWrapping;
  woodBase.anisotropy = aniso;
  extraDispose.push(marbleBase, marbleNormal, marbleRough, woodBase);
  const marbleMat = (rx: number, rz: number) => {
    const maps = [marbleBase, marbleNormal, marbleRough].map(base => {
      const tx = base.clone(); tx.repeat.set(rx, rz); tx.needsUpdate = true; extraDispose.push(tx); return tx;
    });
    return new THREE.MeshStandardMaterial({map: maps[0], normalMap: maps[1], roughnessMap: maps[2], roughness: .72, metalness: 0, normalScale: new THREE.Vector2(.35,.35)});
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
  await onStage(10, STAGES, 'Architecture');
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

  // Main arrival portal: broad glazed side panels, a clear sliding-door opening,
  // illuminated stone jambs and a legible transom. The centre remains walkable.
  box(-20, -4, 0, 6, 12, 12.3, M.wall, true);
  box(4, 20, 0, 6, 12, 12.3, M.wall, true);
  box(-4, 4, 4.2, 6, 12, 12.3, M.wall);
  box(-4, -2.72, 0.08, 4.16, 12.1, 12.18, M.glass, true, false);
  box(2.72, 4, 0.08, 4.16, 12.1, 12.18, M.glass, true, false);
  for (const x of [-2.74, 2.74]) {
    box(x - 0.11, x + 0.11, 0, 4.25, 11.96, 12.34, M.gold, false, false);
    box(x - 0.19, x + 0.19, 0, 0.22, 11.9, 12.38, M.stone, false, false);
  }
  // Glass leaves shown retracted into the side pockets; 2.6 m of clear passage remains.
  for (const [x0, x1] of [[-2.5, -1.3], [1.3, 2.5]]) {
    box(x0, x1, 0.1, 3.55, 12.08, 12.13, M.glass, false, false);
    box(x0, x0 + 0.045, 0.12, 3.52, 12.04, 12.17, M.frame, false, false);
    box(x1 - 0.045, x1, 0.12, 3.52, 12.04, 12.17, M.frame, false, false);
    box((x0 + x1) / 2 - 0.035, (x0 + x1) / 2 + 0.035, 1.2, 2.3, 12.0, 12.08, brassMat, false, false);
  }
  box(-2.82, 2.82, 3.65, 3.76, 11.94, 12.36, darkMetal, false, false);
  box(-2.82, 2.82, 3.77, 3.83, 11.94, 12.36, M.led, false, false);
  box(-4, 4, 4.1, 4.2, 12.0, 12.35, M.gold, false, false);
  // Warm stone foyer inlay marks the transition from the entrance into the atrium.
  plane(-3.55, 3.55, 8.75, 11.72, 0.009, storeFloorMat(0x51463b));
  for (const x of [-3.5, 3.5]) box(x - 0.022, x + 0.022, 0.018, 0.025, 8.78, 11.7, brassMat, false, false);
  for (const z of [8.8, 11.68]) box(-3.5, 3.5, 0.018, 0.025, z - 0.022, z + 0.022, brassMat, false, false);
  const portalBrand = label('JOUMERA', 3.8, 0.58, '#e7d2ad', null, 13);
  portalBrand.position.set(0, 4.86, 11.83); portalBrand.rotation.y = Math.PI;
  const portalSub = label('THE ART OF EVERYDAY LIVING', 3.8, 0.25, '#d1c2a7', null, 3);
  portalSub.position.set(0, 4.47, 11.83); portalSub.rotation.y = Math.PI;
  // A restrained two-ring chandelier gives the foyer a human-scale focal point.
  for (const [radius, tube, y] of [[1.65, 0.055, 5.35], [1.12, 0.035, 5.7]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 56), brassMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, y, 8.3); group.add(ring);
  }
  const entryGlow = new THREE.PointLight(0xffdfb2, 30, 13, 2);
  entryGlow.position.set(0, 5.1, 8.3); group.add(entryGlow);
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
  await onStage(11, STAGES, 'Storefronts');
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
  await onStage(12, STAGES, 'Store interiors');
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
    for (const edge of [zf+.22,zn-.22]) {
      box(...rx(8.55,19.7),3.34,3.47,edge-.12,edge+.12,M.ceil,false,false);
      box(...rx(8.65,19.6),3.43,3.46,edge-.035,edge+.035,M.led,false,false);
    }
    for (const depth of [8.55,19.7]) box(...rx(depth-.1,depth+.1),3.34,3.47,zf+.22,zn-.22,M.ceil,false,false);
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
      // Full-scale textile lounge chairs replace the primitive stools.
      for (const z of [st.zc - 2.7, st.zc + 2.7]) {
        furnishings.place('modern_arm_chair_01', group, s * 11.5, 0, z, 1.0, s * Math.PI / 2, colliders);
      }
    } else if (st.id === 'style-lab') {
      // Fitting lounge: no primitive capsule shapes presented as garments.
      furnishings.place('modern_arm_chair_01', group, s * 11.1, 0, st.zc - 3.2, .95, s * Math.PI / 2, colliders);
    } else if (st.id === 'smart-living') {
      // Circular light installation and floating ledges for connected-home devices.
      for (const z of [st.zc - 2.1, st.zc + 2.1]) {
        const halo = new THREE.Mesh(new THREE.TorusGeometry(.72, .035, 8, 48), led);
        halo.position.set(s * 18.7, 2.15, z); halo.rotation.y = -s * Math.PI / 2; group.add(halo);
        const shelf = box(...rx(16.4, 18.2), 1.08, 1.15, z - .55, z + .55, woodMat, false, false);
        shelf.castShadow = true;
      }
    } else if (st.id === 'beauty-atelier') {
      for (const z of [st.zc-2.6,st.zc+2.6]) furnishings.place('ornate_mirror_01',group,s*19.48,1.35,z,1.5,-s*Math.PI/2);
    }

    // Real cabinet joinery replaces the identical procedural shelf stacks.
    for (const z of [st.zc-2.8,st.zc+2.8]) {
      furnishings.place('modern_wooden_cabinet',group,s*18.8,0,z,1.05,-s*Math.PI/2,colliders);
      if(st.id==='home-gallery') furnishings.place('ceramic_vase_03',group,s*18.8,1.07,z,.5);
    }
    if(st.id==='style-lab') furnishings.place('ornate_mirror_01',group,s*19.45,.2,st.zc,2.4,-s*Math.PI/2);
    furnishings.place('modern_ceiling_lamp_01', group, s * 14, 2.65, st.zc, .8);
    furnishings.place('potted_plant_02', group, s * 17.5, 0, st.zc + 3.6, 1.35, 0, colliders);

    if (st.id === 'home-gallery') {
      furnishings.place('sofa_03', group, s * 17, 0, st.zc, .85, s * Math.PI / 2, colliders);
      furnishings.place('modern_coffee_table_01', group, s * 14, 0, st.zc, .45, 0, colliders);
    } else {
      // Distinct, walk-around joinery: technology demo pods, a beauty bar and fashion plinths.
      const positions=st.id==='beauty-atelier'?[st.zc]:[st.zc-2.05,st.zc+2.05];
      const width=st.id==='tech-studio'?1.7:st.id==='style-lab'?1.05:1.35;
      const length=st.id==='beauty-atelier'?5.8:2.8;
      for(const z of positions) retailCounter(group,colliders,s*14,z,width,length,.84,
        st.id==='tech-studio'?M.stone:st.id==='beauty-atelier'?std(0xb78d82,.5):woodMat,
        st.id==='style-lab'?M.dark:M.stone,brassMat);
    }
    // counter
    const [c0, c1] = rx(10, 10.8);
    box(c0, c1, 0, 1.05, st.zc + 2.9, st.zc + 4.8, M.dark, true);
    box(c0 - 0.02, c1 + 0.02, 1.05, 1.09, st.zc + 2.88, st.zc + 4.82, M.gold, false);

    st.products.slice(0, 4).forEach((p, i) => {
      const home = st.id === 'home-gallery';
      const z = home && i === 0 ? st.zc : st.zc - 2.7 + i * 1.8;
      const x = home && i !== 0 ? s * 18.3 : s * 14;
      let obj: THREE.Object3D;
      const assetName = p.glb?.split('/').pop()?.replace('.glb', '') as AssetName;
      if (ASSETS.includes(assetName)) {
        obj = furnishings.place(assetName, group, x, home ? .46 : .84, z, assetName === 'classic_laptop' ? .32 : .55);
      } else {
        obj = label(`${p.name.en}${p.demo ? ' · DEMO' : ''}`, 1.25, .48, '#e8d5b4', '#19262b', 2);
        obj.position.set(x, 1.1, z); obj.rotation.y = -s * Math.PI / 2;
      }
      pickables.push({ product: p, obj, pos: new THREE.Vector3(x, 1.1, z) });
    });
  };
  STORES.forEach(buildStore);

  // ---------- Stage 4: hall furniture ----------
  await onStage(13, STAGES, 'Furnishing');
  const plant = (x: number, z: number, sc: number) => {
    furnishings.place('potted_plant_02', group, x, z === -17 ? .5 : 0, z, sc * 1.3, 0, colliders);
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
  // Paired upholstered seats make recognisable rest areas at human scale.
  for (const s of [-1, 1]) for (const z of [-5, -23]) {
    furnishings.place('modern_arm_chair_01', group, s * 3.25, 0, z, 1, -s * Math.PI / 2, colliders);
  }
  // Entrance is glazed at the edge of the navigable floor, not an unbounded drop.
  colliders.push({minX:-20,maxX:20,minZ:11.9,maxZ:12.2});

  batchArchitecture(group);
  return {
    group, colliders, pickables, sun,
    update(t: number) {

      animatedDisplays.forEach((m, i) => { m.opacity = .94 + Math.sin(t * .7 + i) * .035; });
    },
    dispose() {
      disposeObject(group);
      extraDispose.forEach((d) => d.dispose());
    },
  };
}
