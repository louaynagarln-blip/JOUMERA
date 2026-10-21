import { describe, expect, it } from 'vitest';
import { resolveCircle } from '../src/controls/collision';
import { NavGrid } from '../src/controls/nav';
import { approach, approachAngle, shapeStick, stickFromOrigin } from '../src/controls/motion';
import { addLine, setQty, totalCents, MAX_QTY } from '../src/cart';
import { searchProducts, searchStores } from '../src/data/search';

const wall = { minX: -1, maxX: 1, minZ: -0.1, maxZ: 0.1 };

describe('resolveCircle', () => {
  it('pushes a circle out of a wall', () => {
    expect(resolveCircle(0, 0.2, 0.3, [wall]).z).toBeGreaterThanOrEqual(0.4 - 1e-6);
  });
  it('leaves free circles alone', () => {
    expect(resolveCircle(5, 5, 0.3, [wall])).toEqual({ x: 5, z: 5 });
  });
  it('ejects a centre that is inside a box', () => {
    expect(Math.abs(resolveCircle(0, 0, 0.3, [wall]).z)).toBeGreaterThanOrEqual(0.4 - 1e-6);
  });
});

describe('NavGrid', () => {
  const nav = new NavGrid([{ minX: -10, maxX: 4, minZ: -0.2, maxZ: 0.2 }], { minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
  it('routes through the gap', () => {
    const p = nav.findPath(-5, 5, -5, -5);
    expect(p).not.toBeNull();
    expect(p!.some((pt) => pt.x > 4)).toBe(true);
  });
  it('ends at the goal', () => {
    const p = nav.findPath(0, 5, 8, -5)!;
    expect(p[p.length - 1]).toEqual({ x: 8, z: -5 });
  });
});

describe('movement response', () => {
  it('keeps the joystick quiet at centre and shapes full diagonal travel', () => {
    expect(shapeStick(0.04, -0.03)).toEqual({ x: 0, y: 0 });
    const diagonal = shapeStick(1, 1);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 8);
  });
  it('does not move when a joystick is first touched away from its centre', () => {
    const start = { x: 25, y: 140 };
    expect(stickFromOrigin(start.x, start.y, start.x, start.y, 35)).toEqual({ x: 0, y: 0 });
    expect(stickFromOrigin(25, 140, 25, 140, 35)).toEqual({ x: 0, y: 0 });
  });
  it('clamps a joystick drag relative to its touch origin', () => {
    const delta = stickFromOrigin(100, 140, 25, 140, 35);
    expect(delta.x).toBeCloseTo(35);
    expect(delta.y).toBe(0);
  });
  it('eases toward walking speed without overshooting', () => {
    const v = approach(0, 1.25, 0.05, 4.8);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1.25);
    expect(approach(v, 0, 0.05, 7.5)).toBeLessThan(v);
  });
  it('turns across the angle seam by the short direction', () => {
    const result = approachAngle(Math.PI - 0.1, -Math.PI + 0.1, 1 / 60, 3.2);
    expect(result).toBeGreaterThan(Math.PI - 0.1);
    expect(result).toBeLessThan(Math.PI + 0.1);
  });
});

describe('cart', () => {
  it('merges identical lines and caps quantity', () => {
    const l = addLine(addLine([], 'a', 'x', 2), 'a', 'x', 100);
    expect(l).toEqual([{ slug: 'a', variant: 'x', qty: MAX_QTY }]);
  });
  it('removes a line at qty 0', () => {
    expect(setQty(addLine([], 'a', 'x'), 'a', 'x', 0)).toEqual([]);
  });
  it('totals in integer cents and skips unpriced items', () => {
    const l = addLine(addLine([], 'a', '', 3), 'b', '', 1);
    expect(totalCents(l, (s) => (s === 'a' ? 19.99 : null))).toBe(5997);
  });
});

describe('HOCO flagship store', () => {
  it('is discoverable by its name and navigable inside the mall', () => {
    expect(searchStores('hoco').some(store => store.id === 'hoco')).toBe(true);
    const hoco = STORES.find(store => store.id === 'hoco')!;
    expect(storeRect(hoco)).toEqual({ minX: 8.25, maxX: 20, minZ: -1, maxZ: 9 });
  });
  it('shows owner-supplied electronics as display-only until stock and prices are verified', () => {
    const hoco = STORES.find(store => store.id === 'hoco')!;
    expect(hoco.tagline.en).toMatch(/electronics/i);
    expect(hoco.products).toHaveLength(3);
    expect(hoco.products.every(p => !p.demo && p.priceUSD === null && !p.available)).toBe(true);
    expect(hoco.products.map(p => p.image)).toEqual([
      '/assets/hoco/hoco-dv203-dual-lensdigital-camera.webp',
      '/assets/hoco/hoco-dv102-4k-anti-shake-sports-camera.webp',
      '/assets/hoco/Hoco-DFM01-LED-Indicator-BT-FM-Transmitter-38W-Black-FM-Transmitter-HOCO-Star-Light-Kuwait.webp',
    ]);
    expect(totalCents(addLine([], hoco.products[0].slug, ''), slug => hoco.products.find(p => p.slug === slug)?.priceUSD ?? null)).toBe(0);
  });
});

describe('catalog search', () => {
  it('finds products in Arabic and English', () => {
    expect(searchProducts('حاسوب').some((hit) => hit.product.slug === 'demo-laptop-14')).toBe(true);
    expect(searchProducts('portable speaker').some((hit) => hit.product.slug === 'demo-speaker-portable')).toBe(true);
  });
  it('finds a store by its localized tagline and exposes its products', () => {
    expect(searchStores('إلكترونيات')[0]?.id).toBe('tech-studio');
    expect(searchProducts('tech studio')).toHaveLength(4);
  });
  it('returns no results for blank or unrelated text', () => {
    expect(searchProducts('   ')).toHaveLength(0);
    expect(searchProducts('unlisted product')).toHaveLength(0);
  });
});

import { moveCircle } from '../src/controls/collision';
import { Player } from '../src/controls/player';

describe('walking acceptance', () => {
  it('does not tunnel through thin glass during a delayed frame', () => {
    const p = moveCircle(0, 2, 0, -4, .3, [wall]);
    expect(p.z).toBeGreaterThanOrEqual(.4 - 1e-6);
  });
  it('slides along a wall while retaining clearance', () => {
    const p = moveCircle(-.7, .45, 1.1, -.5, .3, [wall]);
    expect(p.x).toBeGreaterThan(.3);
    expect(p.z).toBeGreaterThanOrEqual(.4 - 1e-6);
  });
  it('fits through a 1.4m doorway without snagging', () => {
    const walls = [{minX:-4,maxX:-.7,minZ:-.1,maxZ:.1},{minX:.7,maxX:4,minZ:-.1,maxZ:.1}];
    expect(moveCircle(0,2,0,-4,.3,walls)).toEqual({x:0,z:expect.closeTo(-2,6)});
  });
  it('produces consistent walking distance at 10 and 60 FPS', () => {
    const run = (fps: number) => {
      const p = new Player([]); p.enabled = true; p.walkPath([{x:0,z:-20}]);
      for (let i=0;i<fps*3;i++) p.update(1/fps);
      return p.z;
    };
    expect(run(10)).toBeCloseTo(run(60), 4);
  });
  it('cancels navigation without residual movement and keeps eye height', () => {
    const p = new Player([]); p.enabled = true; p.walkPath([{x:0,z:-20}]);
    p.update(.2); p.cancelPath(); const z=p.z; p.update(.2);
    expect(p.z).toBe(z); expect(p.camera.position.y).toBe(1.65);
  });
  it('rejects routes beyond the mall and keeps same-cell destinations', () => {
    const nav = new NavGrid([], {minX:-2,maxX:2,minZ:-2,maxZ:2});
    expect(nav.isFree(20,0)).toBe(false);
    expect(nav.findPath(0,0,20,0)).toBeNull();
    expect(nav.findPath(.1,.1,.2,.2)).toEqual([{x:.2,z:.2}]);
  });
  it('discards tab suspension gaps instead of teleporting', () => {
    const p = new Player([]); p.enabled = true; p.walkPath([{x:0,z:-20}]); p.update(30);
    expect(9-p.z).toBeLessThan(.32);
  });
  it('discards long frame gaps so returning to the tab cannot continue a stale walk', () => {
    const p = new Player([]); p.enabled = true; p.walkPath([{x:0,z:-20}]);
    p.update(0.21);
    expect(p.autoWalking).toBe(false);
    expect(p.z).toBe(9);
    p.update(.05);
    expect(p.z).toBe(9);
  });
  it('clears auto-walk and motion whenever an overlay disables the controller', () => {
    const p = new Player([]); p.enabled = true; p.walkPath([{x:0,z:-20}]);
    p.update(.05); p.enabled = false;
    const z = p.z;
    p.update(.1); p.enabled = true; p.update(.1);
    expect(p.autoWalking).toBe(false);
    expect(p.z).toBe(z);
  });
});

import { applyLiveCatalog, publicAsset } from '../src/data/liveCatalog';
import { STORES, ALL_PRODUCTS, storeRect } from '../src/data/catalog';

describe('live catalogue boundary', () => {
  it('rejects executable and credential-bearing asset URLs', () => {
    expect(publicAsset('javascript:alert(1)')).toBeUndefined();
    expect(publicAsset('https://name:secret@example.com/model.glb')).toBeUndefined();
    expect(publicAsset('/assets/../private')).toBeUndefined();
    expect(publicAsset('/assets/models/ceramic_vase_03.glb')).toBe('/assets/models/ceramic_vase_03.glb');
  });
  it('keeps empty live responses clearly labelled demo', () => {
    expect(applyLiveCatalog([])).toBe(0);
    expect(ALL_PRODUCTS.filter(p => p.storeId !== 'hoco').every(p => p.demo)).toBe(true);
    expect(ALL_PRODUCTS.find(p => p.storeId === 'hoco')?.demo).toBe(false);
  });
  it('does not map unrelated wholesale feed rows into the HOCO electronics display', () => {
    const before = STORES.find(s => s.id === 'hoco')!.products;
    const count = applyLiveCatalog([{slug:'bedding-row',store_slug:'hoco',name_en:'Sherpa Blanket',name_ar:null,retail_price:24,in_stock:true}]);
    expect(count).toBe(0);
    expect(STORES.find(s => s.id === 'hoco')!.products).toBe(before);
  });
  it('integrates approved records instead of matching only demo slugs', () => {
    const before = STORES.map(s => s.products);
    try {
      expect(applyLiveCatalog([{slug:'verified-vase',store_slug:'home-gallery',name_en:'Verified vase',name_ar:null,retail_price:25,in_stock:true}])).toBe(1);
      const p = ALL_PRODUCTS.find(p => p.slug==='verified-vase');
      expect(p?.demo).toBe(false); expect(p?.priceUSD).toBe(25);
      expect(STORES.find(s=>s.id==='home-gallery')?.products).toHaveLength(1);
    } finally {
      STORES.forEach((s,i)=>{s.products=before[i];});
      ALL_PRODUCTS.splice(0,ALL_PRODUCTS.length,...STORES.flatMap(s=>s.products));
    }
  });
});

import {nextOrderStates,escapeHTML} from '../src/operations';
describe('management operations',()=>{
 it('offers only permitted lifecycle actions and keeps terminal orders closed',()=>{
  expect(nextOrderStates('new')).toEqual(['confirmed','cancelled']);
  expect(nextOrderStates('confirmed')).toEqual(['out_for_delivery','cancelled']);
  expect(nextOrderStates('out_for_delivery')).toEqual(['delivered','cancelled']);
  expect(nextOrderStates('delivered')).toEqual([]);expect(nextOrderStates('cancelled')).toEqual([]);
 });
 it('escapes supplier and customer text before rendering HTML',()=>{
  expect(escapeHTML('<img src=x onerror="bad">')).toBe('&lt;img src=x onerror=&quot;bad&quot;&gt;');
  expect(escapeHTML(null)).toBe('');
 });
});

import * as THREE from 'three';
import {boutiquePortal,retailCounter} from '../src/world/retailFixtures';
describe('retail furnishing clearance',()=>{
 it('frames a wide, unobstructed store entrance with an arched display portal',()=>{
  const group=new THREE.Group();boutiquePortal(group,8.25,-4,0x345678,1);
  const bounds=new THREE.Box3().setFromObject(group);
  expect(bounds.max.x-bounds.min.x).toBeLessThan(.2);
  expect(bounds.max.y).toBeGreaterThan(3.1);
  expect(bounds.max.y).toBeLessThan(3.4);
  expect(bounds.max.z-bounds.min.z).toBeGreaterThan(3.3);
  expect(group.children[0].position.x).toBe(8.25);
 });
 it('keeps the bevelled joinery inside its collision envelope',()=>{
  const group=new THREE.Group();const boxes:Array<{minX:number;maxX:number;minZ:number;maxZ:number}>=[];
  const mat=new THREE.MeshStandardMaterial();retailCounter(group,boxes,14,-2,1.7,2.8,.84,mat,mat,mat);
  const b=new THREE.Box3().setFromObject(group), c=boxes[0];
  expect(b.min.x).toBeGreaterThanOrEqual(c.minX-.001);expect(b.max.x).toBeLessThanOrEqual(c.maxX+.001);
  expect(b.min.z).toBeGreaterThanOrEqual(c.minZ-.001);expect(b.max.z).toBeLessThanOrEqual(c.maxZ+.001);
  expect(b.max.y).toBeCloseTo(.842,2);
 });
});
