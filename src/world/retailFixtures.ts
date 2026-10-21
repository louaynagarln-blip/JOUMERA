import * as THREE from 'three';
import type { Box } from '../controls/collision';

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
