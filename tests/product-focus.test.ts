import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ALL_PRODUCTS } from '../src/data/catalog';
import { ProductFocus } from '../src/world/productFocus';

function fixture() {
  const scene = new THREE.Group();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  const obj = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, .4), new THREE.MeshBasicMaterial());
  obj.position.set(0, 1.6, -2); scene.add(obj);
  const item = { obj, pos: obj.position.clone(), product: ALL_PRODUCTS[0] };
  return { scene, camera, item };
}
function obstacle(scene: THREE.Group, transparent = false, glass = false) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2, .05), new THREE.MeshBasicMaterial({ transparent, opacity: transparent ? .2 : 1 }));
  wall.position.set(0, 1.6, -1); wall.userData.blocksInteraction = glass; scene.add(wall); return wall;
}
describe('camera product visibility', () => {
  it('selects an unobstructed product', () => {
    const {scene,camera,item}=fixture(); expect(new ProductFocus(scene,[item]).select(camera)).toBe(item);
  });
  it('blocks interaction through solid walls', () => {
    const {scene,camera,item}=fixture(); obstacle(scene); expect(new ProductFocus(scene,[item]).select(camera)).toBeNull();
  });
  it('blocks interaction through storefront glass', () => {
    const {scene,camera,item}=fixture(); obstacle(scene,true,true); expect(new ProductFocus(scene,[item]).select(camera)).toBeNull();
  });
  it('ignores decorative transparent overlays', () => {
    const {scene,camera,item}=fixture(); obstacle(scene,true); expect(new ProductFocus(scene,[item]).select(camera)).toBe(item);
  });
  it('respects camera pitch', () => {
    const {scene,camera,item}=fixture(); camera.lookAt(0,5,-1); expect(new ProductFocus(scene,[item]).select(camera)).toBeNull();
  });
  it('rejects distant products', () => {
    const {scene,camera,item}=fixture(); item.obj.position.z=-4; expect(new ProductFocus(scene,[item]).select(camera)).toBeNull();
  });
  it('ignores hidden obstacles and hidden products', () => {
    const {scene,camera,item}=fixture(); obstacle(scene).visible=false;
    const focus=new ProductFocus(scene,[item]); expect(focus.select(camera)).toBe(item);
    item.obj.visible=false; expect(focus.select(camera)).toBeNull();
  });
  it('prefers a centred product to a nearer peripheral one', () => {
    const {scene,camera,item}=fixture(); const obj=item.obj.clone(); obj.position.set(1,1.6,-1.5); scene.add(obj);
    const other={...item,obj,pos:obj.position.clone()}; expect(new ProductFocus(scene,[other,item]).select(camera)).toBe(item);
  });
});
