import * as THREE from 'three';
import type { StoreDef } from '../data/catalog';

export interface DisplaySlot {
  x: number; y: number; z: number; yaw: number;
  width: number; depth: number; height: number;
}

/** Positions refer to the actual fixture tops, in metres. */
export function productDisplaySlot(store: StoreDef, index: number): DisplaySlot {
  if (!Number.isInteger(index) || index < 0 || index > 3) throw new RangeError('Display slot must be 0–3');
  const base = { yaw: -store.side * Math.PI / 2, width: .65, depth: .7, height: .5 };
  if (store.id === 'home-gallery') {
    if (index === 0) return { ...base, x: store.side * 14, y: .452, z: store.zc, height: .36 };
    // Rear consoles are centred at ±2.8 m, not spread evenly across the empty wall.
    const offset = index === 1 ? -2.8 : index === 2 ? 2.45 : 3.15;
    return { ...base, x: store.side * 18.8, y: 1.052, z: store.zc + offset, width: .32, depth: .5 };
  }
  return { ...base, x: store.side * 14, y: .844, z: store.zc - 2.7 + index * 1.8 };
}

/** Normalise actual bounds after rotation; works for GLB pivots and procedural stand-ins. */
export function seatDisplayObject(object: THREE.Object3D, slot: DisplaySlot): void {
  object.position.set(0, 0, 0);
  object.rotation.y = slot.yaw;
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(1, slot.width / Math.max(size.x, .001), slot.depth / Math.max(size.z, .001), slot.height / Math.max(size.y, .001));
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);
  bounds.setFromObject(object);
  const centre = bounds.getCenter(new THREE.Vector3());
  object.position.set(slot.x - centre.x, slot.y - bounds.min.y, slot.z - centre.z);
  object.updateMatrixWorld(true);
}

/** Contain the original photograph, without stretching or cropping its product. */
export function photoSize(width: number, height: number, maxWidth: number, maxHeight: number): [number, number] {
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return [maxWidth, maxHeight];
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return [width * scale, height * scale];
}
