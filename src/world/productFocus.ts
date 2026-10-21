import * as THREE from 'three';
import type { Pickable } from './mall';

function visible(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}
function belongsTo(object: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node === root) return true;
  return false;
}

/** Static mall focus: measured product bounds, camera pitch and real scene occlusion. */
export class ProductFocus {
  private readonly ray = new THREE.Raycaster();
  private readonly origin = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly targets: Array<{ pickable: Pickable; centre: THREE.Vector3 }>;
  constructor(root: THREE.Object3D, pickables: Pickable[]) {
    root.updateMatrixWorld(true);
    root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        this.meshes.push(object);
      }
    });
    this.targets = pickables.map(pickable => {
      const bounds = new THREE.Box3().setFromObject(pickable.obj);
      return { pickable, centre: bounds.isEmpty() ? pickable.pos.clone() : bounds.getCenter(new THREE.Vector3()) };
    });
  }

  select(camera: THREE.Camera, previous: Pickable | null = null): Pickable | null {
    camera.updateMatrixWorld(true);
    camera.getWorldPosition(this.origin); camera.getWorldDirection(this.forward);
    const candidates = this.targets.flatMap(target => {
      if (!visible(target.pickable.obj)) return [];
      this.direction.subVectors(target.centre, this.origin);
      const distance = this.direction.length();
      if (distance < .01 || distance > 3.2) return [];
      const alignment = this.direction.divideScalar(distance).dot(this.forward);
      if (alignment < .78) return [];
      const score = (1 - alignment) * 2 + distance * .08 - (target.pickable === previous ? .025 : 0);
      return [{ ...target, distance, score }];
    }).sort((a, b) => a.score - b.score);
    for (const candidate of candidates) {
      this.direction.subVectors(candidate.centre, this.origin).normalize();
      this.ray.set(this.origin, this.direction); this.ray.far = candidate.distance + .02;
      const hits = this.ray.intersectObjects(this.meshes, false);
      let blocked = false;
      for (const hit of hits) {
        if (!visible(hit.object)) continue;
        if (belongsTo(hit.object, candidate.pickable.obj)) break;
        const mesh = hit.object as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        // Text labels and contact shadows do not obstruct; storefront glass explicitly does.
        if (!mesh.userData.blocksInteraction && materials.every(m => m.transparent)) continue;
        blocked = true; break;
      }
      if (!blocked) return candidate.pickable;
    }
    return null;
  }
}
