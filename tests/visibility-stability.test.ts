import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Player } from '../src/controls/player';
import { frontFaceX } from '../src/world/signPlacement';

describe('shop sign visibility', () => {
  for (const side of [-1, 1] as const) {
    it(`places the storefront lettering in front of its backing on side ${side}`, () => {
      const min=side===1?7.955:-8.295, max=side===1?8.295:-7.955;
      const wall=new THREE.Mesh(new THREE.BoxGeometry(max-min,1.12,6.56));
      wall.position.set((min+max)/2,4.88,0); wall.updateMatrixWorld();
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(6.4,1.12));
      sign.position.set(frontFaceX(min,max,side),4.88,0); sign.rotation.y=-side*Math.PI/2; sign.updateMatrixWorld();
      const ray=new THREE.Raycaster(new THREE.Vector3(0,4.88,0),new THREE.Vector3(side,0,0));
      expect(ray.intersectObjects([wall,sign])[0].object).toBe(sign);
    });
    it(`places rear brand panel lettering ahead of wall flutes on side ${side}`, () => {
      const face=frontFaceX(Math.min(side*19.68,side*19.8),Math.max(side*19.68,side*19.8),side);
      expect(Math.abs(face)).toBeLessThan(19.68);
      expect(Math.abs(face)).toBeLessThan(19.82);
    });
  }
});
describe('camera continuity', () => {
  it('preserves viewing direction when a modal disables walking', () => {
    const p=new Player([]); p.enabled=true; p.pitch=.4; p.yaw=1.2; p.update(1/60);
    const before=p.camera.quaternion.clone(); p.enabled=false; p.update(1/60);
    expect(p.camera.quaternion.angleTo(before)).toBeCloseTo(0);
  });
  it('stops navigation after a suspended frame without snapping camera pitch', () => {
    const p=new Player([]); p.enabled=true; p.pitch=-.35; p.yaw=.8; p.update(1/60);
    const before=p.camera.quaternion.clone(), position=p.camera.position.clone();
    p.walkPath([{x:0,z:-10}]); p.update(2);
    expect(p.autoWalking).toBe(false);
    expect(p.camera.position.distanceTo(position)).toBe(0);
    expect(p.camera.quaternion.angleTo(before)).toBeCloseTo(0);
  });
});
