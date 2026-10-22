import * as THREE from 'three';
import type { Product } from '../data/catalog';

/** Bilingual shelf information, deliberately without unverified retail prices. */
export function productCard(product: Product, width: number, anisotropy: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 448;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ede8df'; ctx.fillRect(0, 0, 1024, 448);
  ctx.fillStyle = '#a78349'; ctx.fillRect(40, 35, 6, 378);
  const fit = (text: string, y: number, initial: number, color: string, rtl = false) => {
    let size = initial;
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    do { ctx.font = `500 ${size}px system-ui, sans-serif`; size -= 1; } while (ctx.measureText(text).width > 875 && size > 18);
    ctx.fillText(text, rtl ? 955 : 78, y);
  };
  fit(product.name.en, 104, 43, '#27241f');
  fit(product.name.ar, 198, 43, '#403a31', true);
  ctx.fillStyle = '#c7b9a1'; ctx.fillRect(78, 260, 876, 2);
  fit(product.demo ? 'DISPLAY SAMPLE' : 'CATALOGUE DISPLAY', 315, 29, '#765a32');
  fit(product.demo ? 'نموذج عرض تجريبي' : 'عرض فقط — البيع غير مفعّل', 381, 30, '#765a32', true);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 448 / 1024),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide }));
  mesh.userData.interactive = true;
  return mesh;
}
