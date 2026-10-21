import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildMall, BOUNDS, STAGES, type Mall, type Pickable } from './world/mall';
import { Player } from './controls/player';
import { NavGrid } from './controls/nav';
import { STORES, ALL_PRODUCTS, storeRect, type StoreDef } from './data/catalog';
import { loadSettings, saveSettings, type Settings } from './settings';
import { isLive, fetchLiveCatalog } from './api/backend';
import { t } from './i18n';
import * as ui from './ui/ui';

type Tier = 'low' | 'medium' | 'high';
const TIERS: Tier[] = ['low', 'medium', 'high'];
const PIXEL_CAP: Record<Tier, number> = { low: 1, medium: 1.5, high: 2 };
const SHADOW: Record<Tier, number> = { low: 0, medium: 0, high: 2048 };

const settings: Settings = loadSettings();
ui.initUI(settings);

window.addEventListener('error', (e) => ui.toast(e.message || 'Error'));
window.addEventListener('unhandledrejection', () => ui.toast('Error'));

async function boot(): Promise<void> {
  ui.setProgress(0.02, t('loading'));
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    ui.showFallback('WebGL unavailable');
    return;
  }
  const stage = document.getElementById('stage')!;
  stage.appendChild(renderer.domElement);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdcd5c9);
  scene.fog = new THREE.Fog(0xdcd5c9, 30, 75);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pm.dispose();

  // live catalogue (only when Supabase is configured); otherwise demo data stays flagged as demo
  let liveNote = false;
  if (isLive) {
    try {
      const rows = await fetchLiveCatalog();
      const bySlug = new Map(rows.map((r) => [r.slug, r]));
      for (const p of ALL_PRODUCTS) {
        const r = bySlug.get(p.slug);
        p.demo = false;
        p.priceUSD = r ? r.retail_price : null;
        p.available = Boolean(r && r.in_stock);
      }
    } catch { liveNote = true; }
  }

  let mall: Mall;
  try {
    mall = await buildMall(renderer, async (i, total, label) => {
      ui.setProgress(0.1 + (0.85 * (i - 1)) / total, label);
      await new Promise((r) => setTimeout(r, 0)); // yield so the progress bar paints
    });
  } catch (e) {
    ui.showFallback((e as Error).message);
    return;
  }
  void STAGES;
  scene.add(mall.group);
  ui.setProgress(0.97, '');

  const player = new Player(mall.colliders);
  const nav = new NavGrid(mall.colliders, BOUNDS);
  player.bind(document.getElementById('look')!, document.getElementById('joy')!, document.getElementById('knob')!, renderer.domElement);
  const applyPlayerSettings = () => {
    player.sensitivity = settings.sens;
    player.headBob = settings.bob;
    player.reducedMotion = settings.reduced;
  };
  applyPlayerSettings();

  // ----- quality -----
  let tier: Tier = settings.quality === 'auto' ? (matchMedia('(pointer:coarse)').matches ? 'medium' : 'high') : settings.quality;
  let pixelScale = 1;
  const applyQuality = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_CAP[tier]) * pixelScale);
    const sm = SHADOW[tier];
    mall.sun.castShadow = sm > 0;
    if (sm > 0 && mall.sun.shadow.mapSize.x !== sm) {
      mall.sun.shadow.mapSize.set(sm, sm);
      mall.sun.shadow.map?.dispose();
      mall.sun.shadow.map = null;
    }
    resize();
  };
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    player.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  applyQuality();

  ui.hooks.onSettings = (s) => {
    saveSettings(s);
    applyPlayerSettings();
    if (s.quality !== 'auto' && s.quality !== tier) { tier = s.quality; pixelScale = 1; applyQuality(); }
    if (s.quality === 'auto') { tier = matchMedia('(pointer:coarse)').matches ? 'medium' : 'high'; pixelScale = 1; applyQuality(); }
  };
  ui.hooks.onModal = (open) => {
    if (open) player.releaseLock();
    player.enabled = !open && entered;
    if (open) player.cancelPath();
  };

  // ----- navigation + interaction -----
  const storeAt = (x: number, z: number): StoreDef | null => {
    for (const s of STORES) { const r = storeRect(s); if (x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ) return s; }
    return null;
  };
  ui.hooks.onWalkTo = (id) => {
    const st = STORES.find((s) => s.id === id);
    if (!st || !player.enabled) return;
    const path = nav.findPath(player.x, player.z, st.side * 11.5, st.zc);
    if (path && path.length) player.walkPath(path);
  };
  player.onAutoWalkEnd = (why) => { if (why === 'stuck') ui.toast(t('stuck')); };
  player.onInteract = ui.triggerInteract;

  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); ui.showContextLost(); });

  // ----- intro + enter -----
  let entered = false;
  const startPlay = () => {
    entered = true;
    player.enabled = true;
    if (matchMedia('(pointer:fine)').matches) renderer.domElement.requestPointerLock?.();
  };
  ui.hooks.onTutorialStart = startPlay;
  ui.hooks.onEnter = () => {
    ui.hideLoading();
    player.yaw = 0;
    if (!ui.maybeTutorial()) startPlay();
  };
  ui.setProgress(1, '');
  ui.showEnter();
  if (liveNote) ui.toast(t('liveFail'));

  // ----- main loop -----
  let raf = 0;
  let last = performance.now();
  let fpsFrames = 0, fpsTime = 0;
  let nearest: Pickable | null = null;
  let curStore: StoreDef | null = null;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!entered) player.yaw = Math.sin(now / 4000) * 0.08; // gentle idle sway on the entrance view
    player.update(dt);
    mall.update(now / 1000);

    if (player.enabled) {
      let best: Pickable | null = null, bestD = 3.2;
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      for (const pk of mall.pickables) {
        const dx = pk.pos.x - player.x, dz = pk.pos.z - player.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD && (dx * fx + dz * fz) / d > 0.6) { best = pk; bestD = d; }
      }
      if (best !== nearest) { nearest = best; ui.setInteract(best ? best.product : null); }
      const st = storeAt(player.x, player.z);
      if (st !== curStore) { curStore = st; ui.setBanner(st); }
    }

    renderer.render(scene, player.camera);

    if (player.enabled && settings.quality === 'auto') {
      fpsFrames++; fpsTime += dt;
      if (fpsTime > 3) {
        const fps = fpsFrames / fpsTime;
        fpsFrames = 0; fpsTime = 0;
        if (fps < 24) {
          if (pixelScale > 0.75) pixelScale -= 0.25;
          else if (tier !== 'low') tier = TIERS[TIERS.indexOf(tier) - 1];
          else return;
          applyQuality();
          ui.toast(t('lowFps'));
        }
      }
    }
  };
  renderer.domElement.addEventListener('webglcontextrestored', () => { last = performance.now(); raf = requestAnimationFrame(frame); });
  raf = requestAnimationFrame(frame);
}

boot().catch((e) => ui.showFallback((e as Error).message));
