import * as THREE from 'three';
import type { Box } from '../controls/collision';

/** An open, anodized entry portal with a high arch for a distinct boutique threshold. */
export function boutiquePortal(group: THREE.Group, x: number, z: number, accent: number, side: -1 | 1): void {
 const outer = new THREE.Shape();
 outer.moveTo(-1.72, 0); outer.lineTo(1.72, 0); outer.lineTo(1.72, 1.48);
 outer.absarc(0, 1.48, 1.72, 0, Math.PI, false); outer.closePath();
 const opening = new THREE.Path();
 opening.moveTo(-1.49, 0); opening.lineTo(-1.49, 1.48);
 opening.absarc(0, 1.48, 1.49, Math.PI, 0, true); opening.lineTo(1.49, 0); opening.closePath();
 outer.holes.push(opening);
 const geometry = new THREE.ExtrudeGeometry(outer, { depth: .14, bevelEnabled: true, bevelSegments: 2, bevelSize: .018, bevelThickness: .018, curveSegments: 20 });
 const material = new THREE.MeshStandardMaterial({ color: accent, metalness: .48, roughness: .28, emissive: accent, emissiveIntensity: .035 });
 const portal = new THREE.Mesh(geometry, material);
 portal.rotation.y = side * Math.PI / 2;
 portal.position.set(x, .015, z);
 portal.castShadow = true; portal.receiveShadow = true;
 group.add(portal);
}

/** A joinery component with a rounded plan, recessed plinth, bevelled top and bronze reveal. */
export function retailCounter(group:THREE.Group,colliders:Box[],x:number,z:number,width:number,length:number,height:number,body:THREE.Material,top:THREE.Material,metal:THREE.Material):void{
 const radius=Math.min(.18,width/4,length/4);
 const profile=(w:number,l:number,r:number)=>{
  const s=new THREE.Shape();const a=-w/2,b=-l/2;
  s.moveTo(a+r,b);s.lineTo(a+w-r,b);s.quadraticCurveTo(a+w,b,a+w,b+r);
  s.lineTo(a+w,b+l-r);s.quadraticCurveTo(a+w,b+l,a+w-r,b+l);
  s.lineTo(a+r,b+l);s.quadraticCurveTo(a,b+l,a,b+l-r);s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);return s;
 };
 const layer=(w:number,l:number,y:number,h:number,material:THREE.Material,bevel:number)=>{
  const g=new THREE.ExtrudeGeometry(profile(w,l,radius),{depth:h,steps:1,curveSegments:5,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2});
  g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);
 };
 layer(width-.12,length-.12,.025,.10,metal,.01);
 layer(width-.04,length-.04,.13,height-.20,body,.015);
 layer(width,length,height-.07,.012,metal,.005);
 layer(width,length,height-.048,.038,top,.012);
 colliders.push({minX:x-width/2-.02,maxX:x+width/2+.02,minZ:z-length/2-.02,maxZ:z+length/2+.02});
}
