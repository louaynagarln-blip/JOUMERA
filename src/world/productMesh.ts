import * as THREE from 'three';
import type { Product } from '../data/catalog';

/** Procedural STAND-IN geometry for products with no GLB yet. Origin is the base centre. */
export function makeProductMesh(p: Product): THREE.Group {
  const g = new THREE.Group();
  const metal = p.shape === 'laptop' || p.shape === 'speaker' ? 0.7 : 0.1;
  const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.35, metalness: metal });
  mat.userData.tint = true;
  const dark = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.3, metalness: 0.2 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  switch (p.shape) {
    case 'laptop': {
      add(new THREE.BoxGeometry(0.34, 0.015, 0.23), mat, 0, 0.0075, 0);
      const screen = add(new THREE.BoxGeometry(0.34, 0.22, 0.01), mat, 0, 0.12, -0.11);
      screen.rotation.x = -0.18;
      const face = add(new THREE.BoxGeometry(0.31, 0.19, 0.005), dark, 0, 0.12, -0.103);
      face.rotation.x = -0.18;
      break;
    }
    case 'speaker':
      add(new THREE.CylinderGeometry(0.075, 0.085, 0.26, 32), mat, 0, 0.13, 0);
      add(new THREE.CylinderGeometry(0.077, 0.077, 0.02, 32), dark, 0, 0.27, 0);
      break;
    case 'vase': {
      const pts = [[0.0, 0], [0.07, 0], [0.1, 0.08], [0.11, 0.17], [0.08, 0.27], [0.04, 0.33], [0.05, 0.38], [0.065, 0.4]].map(([x, y]) => new THREE.Vector2(x, y));
      add(new THREE.LatheGeometry(pts, 32), mat, 0, 0, 0);
      break;
    }
    case 'bottle':
      add(new THREE.CylinderGeometry(0.04, 0.045, 0.14, 32), mat, 0, 0.07, 0);
      add(new THREE.CylinderGeometry(0.014, 0.018, 0.03, 16), dark, 0, 0.155, 0);
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.035, 16), dark, 0, 0.19, 0);
      break;
    case 'bag': {
      add(new THREE.BoxGeometry(0.32, 0.24, 0.12), mat, 0, 0.12, 0);
      const handle = add(new THREE.TorusGeometry(0.08, 0.008, 8, 24, Math.PI), dark, 0, 0.24, 0);
      handle.rotation.y = 0;
      break;
    }
    case 'lamp':
      add(new THREE.CylinderGeometry(0.08, 0.09, 0.02, 32), dark, 0, 0.01, 0);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 12), dark, 0, 0.17, 0);
      add(new THREE.CylinderGeometry(0.06, 0.11, 0.14, 32, 1, true), new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.6, side: THREE.DoubleSide, emissive: p.color, emissiveIntensity: 0.15 }), 0, 0.34, 0);
      break;
  }
  return g;
}
