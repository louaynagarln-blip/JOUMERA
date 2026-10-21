import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Box } from '../controls/collision';

export const ASSETS = ['modern_arm_chair_01', 'ceramic_vase_03', 'potted_plant_02', 'modern_ceiling_lamp_01', 'classic_laptop', 'sofa_03', 'modern_coffee_table_01', 'modern_wooden_cabinet', 'ornate_mirror_01'] as const;
export type AssetName = typeof ASSETS[number];

/** One decoded resource set per asset; placements share geometry, textures and materials. */
export class Furnishings {
  private models = new Map<AssetName, THREE.Group>();
  private contactShadow: THREE.Texture | null = null;
  async load(progress: (done: number, total: number) => Promise<void>): Promise<void> {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    // Sequential decoding bounds peak memory on mobile and reports real completed files.
    for (const name of ASSETS) {
      const gltf = await loader.loadAsync(`/assets/models/${name}.glb`);
      gltf.scene.traverse(o => {
        if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = true; }
      });
      this.models.set(name, gltf.scene);
      await progress(this.models.size, ASSETS.length);
    }
  }

  place(name: AssetName, parent: THREE.Group, x: number, y: number, z: number,
    height: number, yaw = 0, colliders?: Box[]): THREE.Group {
    const model = this.models.get(name);
    if (!model) throw new Error(`Missing furnishing: ${name}`);
    const obj = model.clone(true);
    const source = new THREE.Box3().setFromObject(obj);
    const size = source.getSize(new THREE.Vector3());
    const centre = source.getCenter(new THREE.Vector3());
    const scale = height / Math.max(size.y, .001);
    obj.scale.multiplyScalar(scale);
    obj.position.set(-centre.x * scale, -source.min.y * scale, -centre.z * scale);
    const pivot = new THREE.Group(); pivot.add(obj);
    pivot.position.set(x, y, z); pivot.rotation.y = yaw;
    parent.add(pivot); pivot.updateMatrixWorld(true);
    if (colliders) {
      const b = new THREE.Box3().setFromObject(pivot);
      colliders.push({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z });
    }
    if(colliders){
      if(!this.contactShadow){
        const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
        const ctx=canvas.getContext('2d')!;const gradient=ctx.createRadialGradient(64,64,12,64,64,64);
        gradient.addColorStop(0,'rgba(0,0,0,.5)');gradient.addColorStop(.55,'rgba(0,0,0,.24)');gradient.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);this.contactShadow=new THREE.CanvasTexture(canvas);
      }
      const bounds=new THREE.Box3().setFromObject(pivot);const extent=bounds.getSize(new THREE.Vector3());
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(extent.x*1.18,extent.z*1.18),new THREE.MeshBasicMaterial({map:this.contactShadow,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1}));
      shadow.rotation.x=-Math.PI/2;shadow.position.set(x,y+.012,z);parent.add(shadow);
    }
    // Detailed furnishings are omitted beyond 36 m; architecture remains visible.
    const lod = new THREE.LOD(); pivot.remove(obj); lod.addLevel(obj, 0); lod.addLevel(new THREE.Group(), 36); pivot.add(lod);
    return pivot;
  }
}

/** Deduplicated disposal also releases embedded GLB textures. */
export function disposeObject(root: THREE.Object3D): void {
  const resources = new Set<{ dispose(): void }>();
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    resources.add(o.geometry);
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
    }
  });
  resources.forEach(resource => resource.dispose());
}

/** Batch opaque architectural surfaces by material and spatial cell, retaining useful culling. */
export function batchArchitecture(group: THREE.Group): void {
  group.updateMatrixWorld(true);
  const batches = new Map<string, THREE.Mesh[]>();
  for (const object of group.children) {
    if (object.userData.interactive || !(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material) || object.material.transparent) continue;
    const bounds = new THREE.Box3().setFromObject(object);
    const c = bounds.getCenter(new THREE.Vector3());
    const key = `${object.material.uuid}/${object.castShadow}/${object.receiveShadow}/${Math.floor(c.x/12)}/${Math.floor(c.z/12)}/${Boolean(object.geometry.index)}/${Object.keys(object.geometry.attributes).sort().join(',')}`;
    const batch = batches.get(key) ?? []; batch.push(object); batches.set(key,batch);
  }
  for (const objects of batches.values()) {
    if (objects.length < 3) continue;
    const copies = objects.map(o=>o.geometry.clone().applyMatrix4(o.matrixWorld));
    const geometry = mergeGeometries(copies, false);
    copies.forEach(g=>g.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry,objects[0].material);
    mesh.castShadow=objects[0].castShadow; mesh.receiveShadow=objects[0].receiveShadow;
    const old = new Set<THREE.BufferGeometry>();
    objects.forEach(o=>{group.remove(o);old.add(o.geometry);});
    old.forEach(g=>g.dispose()); group.add(mesh);
  }
}
