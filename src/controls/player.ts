import * as THREE from 'three';
import { resolveCircle, type Box } from './collision';
import type { Pt } from './nav';

const EYE = 1.65;
const RADIUS = 0.3;
const WALK = 1.4;
const RUN = 2.1;
const JOY_R = 56;

export class Player {
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
  x = 0; z = 9; yaw = 0; pitch = 0;
  enabled = false;
  sensitivity = 1; headBob = true; reducedMotion = false;
  onInteract: () => void = () => {};
  onAutoWalkEnd: (reason: 'arrived' | 'stuck') => void = () => {};

  private vx = 0; private vz = 0;
  private pendY = 0; private pendP = 0;
  private joy = { x: 0, y: 0 };
  private keys = new Set<string>();
  private path: Pt[] = [];
  private bobT = 0;
  private stuckT = 0;
  private locked = false;
  private joyId: number | null = null;
  private lookId: number | null = null;
  private lastX = 0; private lastY = 0;

  constructor(private readonly colliders: Box[]) {
    this.camera.rotation.order = 'YXZ';
    this.syncCamera(0);
  }

  get autoWalking(): boolean { return this.path.length > 0; }
  walkPath(p: Pt[]): void { this.path = p.slice(); this.stuckT = 0; }
  cancelPath(): void { this.path = []; }
  resize(w: number, h: number): void { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  /** Wire touch + pointer + keyboard input. Pointer IDs are tracked so joystick and look never fight. */
  bind(lookEl: HTMLElement, joyEl: HTMLElement, knob: HTMLElement, lockTarget: HTMLElement): void {
    const joyMove = (e: PointerEvent) => {
      const r = joyEl.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > JOY_R) { dx = (dx / len) * JOY_R; dy = (dy / len) * JOY_R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / JOY_R, ny = -dy / JOY_R;
      const m = Math.hypot(nx, ny);
      this.joy = m < 0.1 ? { x: 0, y: 0 } : { x: nx, y: ny };
    };
    const joyEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.joy = { x: 0, y: 0 };
      knob.style.transform = 'translate(0,0)';
    };
    joyEl.addEventListener('pointerdown', (e) => {
      if (this.joyId !== null) return;
      e.preventDefault(); e.stopPropagation();
      this.joyId = e.pointerId;
      joyEl.setPointerCapture(e.pointerId);
      this.path = []; // touching the joystick stops auto-walk instantly
      joyMove(e);
    });
    joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === this.joyId) joyMove(e); });
    joyEl.addEventListener('pointerup', joyEnd);
    joyEl.addEventListener('pointercancel', joyEnd);

    lookEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') { if (this.enabled && !this.locked) lockTarget.requestPointerLock?.(); return; }
      if (this.lookId !== null) return;
      this.lookId = e.pointerId;
      lookEl.setPointerCapture(e.pointerId);
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    lookEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId || !this.enabled) return;
      this.pendY += (e.clientX - this.lastX) * 0.0045 * this.sensitivity;
      this.pendP += (e.clientY - this.lastY) * 0.0045 * this.sensitivity;
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    const lookEnd = (e: PointerEvent) => { if (e.pointerId === this.lookId) this.lookId = null; };
    lookEl.addEventListener('pointerup', lookEnd);
    lookEl.addEventListener('pointercancel', lookEnd);

    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === lockTarget; });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.pendY += e.movementX * 0.0022 * this.sensitivity;
      this.pendP += e.movementY * 0.0022 * this.sensitivity;
    });
    const typing = (e: KeyboardEvent) => ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (k === 'e' || k === 'f') { if (this.enabled) this.onInteract(); return; }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.joy = { x: 0, y: 0 }; });
  }

  releaseLock(): void { if (document.pointerLockElement) document.exitPointerLock(); }

  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    if (!this.enabled || dt <= 0) { this.syncCamera(0); return; }

    const k = 1 - Math.exp(-(this.reducedMotion ? 40 : 22) * dt);
    const ty = this.pendY * k, tp = this.pendP * k;
    this.yaw -= ty; this.pendY -= ty;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - tp)); this.pendP -= tp;

    let ix = this.joy.x, iy = this.joy.y;
    const K = this.keys;
    if (K.has('d') || K.has('arrowright')) ix += 1;
    if (K.has('a') || K.has('arrowleft')) ix -= 1;
    if (K.has('w') || K.has('arrowup')) iy += 1;
    if (K.has('s') || K.has('arrowdown')) iy -= 1;
    const mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; }
    if (mag > 0.01 && this.path.length) this.path = [];

    let tx = 0, tz = 0;
    if (this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - this.x, dz = wp.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.35) {
        this.path.shift();
        if (!this.path.length) this.onAutoWalkEnd('arrived');
      } else {
        const want = Math.atan2(-dx, -dz);
        const d = ((want - this.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        this.yaw += d * (1 - Math.exp(-4 * dt));
        this.pitch += (0 - this.pitch) * (1 - Math.exp(-3 * dt));
        const sp = WALK * Math.max(0.15, 1 - Math.abs(d) / 1.1);
        tx = -Math.sin(this.yaw) * sp;
        tz = -Math.cos(this.yaw) * sp;
      }
    } else {
      const sp = (K.has('shift') ? RUN : WALK) * Math.min(1, mag);
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const n = mag > 0 ? 1 / Math.max(mag, 1e-6) : 0;
      tx = (rx * ix + fx * iy) * n * sp;
      tz = (rz * ix + fz * iy) * n * sp;
    }

    const a = 1 - Math.exp(-(tx || tz ? 7 : 10) * dt); // gentle start, slightly quicker stop
    this.vx += (tx - this.vx) * a;
    this.vz += (tz - this.vz) * a;

    const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    const r = resolveCircle(nx, nz, RADIUS, this.colliders);
    const moved = Math.hypot(r.x - this.x, r.z - this.z) / dt;
    this.vx = (r.x - this.x) / dt;
    this.vz = (r.z - this.z) / dt;
    this.x = r.x; this.z = r.z;

    if (this.path.length) {
      this.stuckT = moved < 0.12 ? this.stuckT + dt : 0;
      if (this.stuckT > 2) { this.path = []; this.onAutoWalkEnd('stuck'); }
    }
    this.syncCamera(Math.hypot(this.vx, this.vz), dt);
  }

  private syncCamera(speed: number, dt = 0): void {
    let bob = 0;
    if (this.headBob && !this.reducedMotion && speed > 0.05) {
      this.bobT += dt * speed * 8;
      bob = Math.sin(this.bobT) * 0.012 * Math.min(1, speed / WALK);
    }
    this.camera.position.set(this.x, EYE + bob, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
