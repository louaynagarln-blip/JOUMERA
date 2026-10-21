import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Product } from '../data/catalog';
import { disposeObject } from '../world/assets';

export type ViewerStatus = 'loading' | 'ready' | 'placeholder' | 'error';

/** Orbit / pinch / wheel product viewer with its own small WebGL context. Loads a GLB if the product has one. */
export class ProductViewer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
  private root = new THREE.Group();
  private pointers = new Map<number, { x: number; y: number }>();
  private dist = 1.1;
  private pinch = 0;
  private raf = 0;
  private envTex: THREE.Texture | null = null;
  private ro: ResizeObserver | null = null;
  private disposed = false;

  constructor(private readonly host: HTMLElement, private readonly product: Product, private readonly onStatus: (s: ViewerStatus) => void) {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onStatus('error');
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    host.appendChild(r.domElement);
    const pm = new THREE.PMREMGenerator(r);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.envTex;
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 3, 2);
    this.scene.add(key, this.root);
    this.root.rotation.x = 0.15;

    this.attach();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.load();
    const loop = () => { if (this.disposed) return; this.raf = requestAnimationFrame(loop); this.render(); };
    loop();
  }

  setTint(hex: number | undefined): void {
    if (hex === undefined) return;
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = o.material as THREE.MeshStandardMaterial;
        if (m.userData?.tint) m.color.setHex(hex);
      }
    });
  }

  private fit(obj: THREE.Object3D): void {
    const bb = new THREE.Box3().setFromObject(obj);
    const size = bb.getSize(new THREE.Vector3());
    const c = bb.getCenter(new THREE.Vector3());
    const s = 0.45 / Math.max(size.x, size.y, size.z, 1e-6);
    obj.scale.multiplyScalar(s);
    obj.position.set(-c.x * s, -c.y * s, -c.z * s);
    this.root.add(obj);
  }

  private load(): void {
    const p = this.product;
    const placeholder = () => { this.onStatus('placeholder'); };
    if (!p.glb) { placeholder(); return; }
    this.onStatus('loading');
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(p.glb, (gltf) => { if (this.disposed) { disposeObject(gltf.scene); return; } this.fit(gltf.scene); this.onStatus('ready'); },
      undefined, () => { if (this.disposed) return; placeholder(); this.onStatus('error'); });
  }

  private attach(): void {
    const el = this.renderer!.domElement;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.pinch = 0; });
    el.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (this.pointers.size === 1) {
        this.root.rotation.y += (cur.x - prev.x) * 0.01;
        this.root.rotation.x = Math.max(-0.9, Math.min(0.9, this.root.rotation.x + (cur.y - prev.y) * 0.01));
      }
      this.pointers.set(e.pointerId, cur);
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch) this.zoom(this.pinch / d);
        this.pinch = d;
      }
    });
    const up = (e: PointerEvent) => { this.pointers.delete(e.pointerId); this.pinch = 0; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.001)); }, { passive: false });
  }

  private zoom(f: number): void { this.dist = Math.max(0.5, Math.min(2.5, this.dist * f)); }

  private resize(): void {
    if (!this.renderer) return;
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private render(): void {
    if (!this.renderer) return;
    this.camera.position.set(0, 0.05, this.dist);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    disposeObject(this.root);
    this.envTex?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
  }
}
