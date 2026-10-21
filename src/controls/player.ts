import * as THREE from 'three';
import { moveCircle, type Box } from './collision';
import type { Pt } from './nav';
import { approach, approachAngle, shapeStick, stickFromOrigin } from './motion';

const EYE = 1.65;
const RADIUS = 0.3;
const WALK = 1.25;
const RUN = 1.85;

export class Player {
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
  x = 0; z = 9; yaw = 0; pitch = 0;
  private _enabled = false;
  get enabled(): boolean { return this._enabled; }
  set enabled(value: boolean) {
    if (this._enabled === value) return;
    this._enabled = value;
    if (!value) this.resetMotion();
  }
  sensitivity = 1; headBob = false; reducedMotion = false;
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
  private lookTravel = 0; private lookStarted = 0;
  private joyOriginX = 0; private joyOriginY = 0; private joyRadius = 56;

  constructor(private readonly colliders: Box[]) {
    this.camera.rotation.order = 'YXZ';
    this.syncCamera(0);
  }

  get autoWalking(): boolean { return this.path.length > 0; }
  walkPath(p: Pt[]): void { this.path = p.slice(); this.stuckT = 0; }
  cancelPath(): void { this.path = []; this.vx = 0; this.vz = 0; }
  stop(): void { this.cancelPath(); this.joy = { x: 0, y: 0 }; this.keys.clear(); }
  private resetMotion(): void {
    this.keys.clear(); this.joy = { x: 0, y: 0 }; this.path = [];
    this.vx = 0; this.vz = 0; this.pendY = 0; this.pendP = 0;
    this.joyId = null; this.lookId = null; this.pitch = 0;
  }
  resize(w: number, h: number): void { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  /** Wire touch + pointer + keyboard input. Pointer IDs are tracked so joystick and look never fight. */
  bind(lookEl: HTMLElement, joyEl: HTMLElement, knob: HTMLElement, lockTarget: HTMLElement): void {
    const joyMove = (e: PointerEvent) => {
      const r = stickFromOrigin(e.clientX, e.clientY, this.joyOriginX, this.joyOriginY, this.joyRadius);
      const dx = r.x, dy = r.y;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy = shapeStick(dx / this.joyRadius, -dy / this.joyRadius, 0.14);
    };
    const joyEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.joy = { x: 0, y: 0 };
      knob.style.transform = 'translate(0,0)';
    };
    joyEl.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.joyId !== null) return;
      e.preventDefault(); e.stopPropagation();
      this.joyId = e.pointerId;
      const rect = joyEl.getBoundingClientRect();
      this.joyOriginX = e.clientX; this.joyOriginY = e.clientY;
      this.joyRadius = Math.max(26, Math.min(rect.width, rect.height) / 2 - 27);
      joyEl.setPointerCapture(e.pointerId);
      this.cancelPath(); // touching the joystick stops auto-walk instantly
      this.joy = { x: 0, y: 0 };
      knob.style.transform = 'translate(0,0)';
    });
    joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === this.joyId) joyMove(e); });
    joyEl.addEventListener('pointerup', joyEnd);
    joyEl.addEventListener('pointercancel', joyEnd);
    joyEl.addEventListener('lostpointercapture', joyEnd);

    lookEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') { if (this.enabled && !this.locked) lockTarget.requestPointerLock?.(); return; }
      if (!this.enabled || this.lookId !== null) return;
      this.lookId = e.pointerId; this.lookTravel = 0; this.lookStarted = performance.now();
      lookEl.setPointerCapture(e.pointerId);
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    lookEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId || !this.enabled) return;
      this.lookTravel += Math.hypot(e.clientX-this.lastX, e.clientY-this.lastY);
      const dx = Math.max(-80, Math.min(80, e.clientX-this.lastX));
      const dy = Math.max(-80, Math.min(80, e.clientY-this.lastY));
      this.pendY += dx * 0.0018 * this.sensitivity;
      this.pendP += dy * 0.0018 * this.sensitivity;
      if (this.path.length && (dx !== 0 || dy !== 0)) this.cancelPath();
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    const lookEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.lookId) return;
      this.lookId = null;
      this.pendY = 0; this.pendP = 0;
    };
    lookEl.addEventListener('pointerup', lookEnd);
    lookEl.addEventListener('pointercancel', lookEnd);
    lookEl.addEventListener('lostpointercapture', lookEnd);

    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === lockTarget; });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.pendY += Math.max(-80, Math.min(80, e.movementX)) * 0.0018 * this.sensitivity;
      this.pendP += Math.max(-80, Math.min(80, e.movementY)) * 0.0018 * this.sensitivity;
      if (this.path.length) this.cancelPath();
    });
    const typing = (e: KeyboardEvent) => ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (k === 'e' || k === 'f') { if (this.enabled) this.onInteract(); return; }
      if (this.enabled) this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    const resetInput = () => { this.resetMotion(); knob.style.transform = 'translate(0,0)'; };
    window.addEventListener('blur', resetInput);
    window.addEventListener('orientationchange', resetInput);
    document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });
    document.addEventListener('pointerup', (e) => { if (e.pointerId === this.joyId) joyEnd(e); if (e.pointerId === this.lookId) lookEnd(e); });
  }

  releaseLock(): void { if (document.pointerLockElement) document.exitPointerLock(); }

  update(dt: number): void {
    // Integrate delayed frames in bounded steps; a background-tab gap is deliberately discarded.
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (dt > 0.2) { this.resetMotion(); this.syncCamera(0); return; }
    let remaining = dt;
    while (remaining > 1e-8) {
      const step = Math.min(remaining, 1 / 120);
      this.step(step);
      remaining -= step;
    }
  }

  private step(dt: number): void {
    if (!this.enabled || dt <= 0) { this.syncCamera(0); return; }

    const k = 1 - Math.exp(-(this.reducedMotion ? 30 : 18) * dt);
    const ty = this.pendY * k, tp = this.pendP * k;
    this.yaw -= ty; this.pendY -= ty;
    this.pitch = Math.max(-0.7, Math.min(0.65, this.pitch - tp)); this.pendP -= tp;

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
      if (dist < (this.path.length === 1 ? .18 : .08)) {
        this.path.shift();
        if (!this.path.length) { this.cancelPath(); this.onAutoWalkEnd('arrived'); }
      } else {
        const want = Math.atan2(-dx, -dz);
        const d = ((want - this.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        this.yaw = approachAngle(this.yaw, want, dt, 3.2);
        this.pitch = approach(this.pitch, 0, dt, 2.4);
        const sp = WALK * Math.max(0.25, 1 - Math.abs(d) / 1.35) * Math.min(1, dist / .65);
        tx = dx / dist * sp;
        tz = dz / dist * sp;
      }
    } else {
      const sp = (K.has('shift') ? RUN : WALK) * Math.min(1, mag);
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const n = mag > 0 ? 1 / Math.max(mag, 1e-6) : 0;
      tx = (rx * ix + fx * iy) * n * sp;
      tz = (rz * ix + fz * iy) * n * sp;
    }

    const response = tx || tz ? 4.8 : 7.5;
    this.vx = approach(this.vx, tx, dt, response);
    this.vz = approach(this.vz, tz, dt, response);

    const r = moveCircle(this.x, this.z, this.vx * dt, this.vz * dt, RADIUS, this.colliders);
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
      bob = Math.sin(this.bobT) * 0.009 * Math.min(1, speed / WALK);
    }
    this.camera.position.set(this.x, EYE + bob, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
