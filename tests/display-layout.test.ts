import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { STORES } from '../src/data/catalog';
import { photoSize, productDisplaySlot, seatDisplayObject } from '../src/world/displayLayout';

describe('physical product placement', () => {
  it('seats an off-centre rotated model on the fixture and contains its footprint', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1));
    mesh.position.set(3, -2, 4); group.add(mesh);
    const slot = productDisplaySlot(STORES[0], 0);
    seatDisplayObject(group, slot);
    const bounds = new THREE.Box3().setFromObject(group);
    const centre = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.min.y).toBeCloseTo(slot.y, 6);
    expect(centre.x).toBeCloseTo(slot.x, 6);
    expect(centre.z).toBeCloseTo(slot.z, 6);
    expect(size.x).toBeLessThanOrEqual(slot.width + 1e-6);
    expect(size.z).toBeLessThanOrEqual(slot.depth + 1e-6);
    expect(size.y).toBeLessThanOrEqual(slot.height + 1e-6);
    mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
  });
  it('puts HOME products on the centre table or either rear console', () => {
    const store = STORES.find(s => s.id === 'home-gallery')!;
    expect(productDisplaySlot(store, 0).y).toBeCloseTo(.452);
    for (let i = 1; i < 4; i++) {
      const slot = productDisplaySlot(store, i);
      expect(slot.x).toBe(store.side * 18.8);
      expect(Math.min(Math.abs(slot.z - store.zc - 2.8), Math.abs(slot.z - store.zc + 2.8))).toBeLessThanOrEqual(.36);
      expect(slot.y).toBeCloseTo(1.052);
    }
  });
  it('places retail displays within their actual counter tops and away from the entrance', () => {
    for (const store of STORES.filter(s => !['home-gallery', 'hoco'].includes(s.id))) {
      for (let i = 0; i < 4; i++) {
        const slot = productDisplaySlot(store, i);
        const centres = store.id === 'beauty-atelier' ? [0] : [-2.05, 2.05];
        const halfLength = store.id === 'beauty-atelier' ? 2.9 : 1.4;
        expect(centres.some(c => Math.abs(slot.z - store.zc - c) < halfLength)).toBe(true);
        expect(Math.abs(slot.x)).toBeGreaterThan(12);
      }
    }
  });
  it('rejects indices outside the built fixtures', () => {
    expect(() => productDisplaySlot(STORES[0], 4)).toThrow(RangeError);
  });
});

describe('photographic display proportions', () => {
  it('contains portrait photographs without stretching', () => {
    const [w, h] = photoSize(600, 1200, 1.9, 1.55);
    expect(w / h).toBeCloseTo(.5); expect(h).toBe(1.55);
  });
  it('contains landscape photographs without cropping', () => {
    const [w, h] = photoSize(1600, 900, .72, .48);
    expect(w).toBe(.72); expect(w / h).toBeCloseTo(16 / 9);
  });
});
