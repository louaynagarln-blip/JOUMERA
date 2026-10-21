import { describe, expect, it } from 'vitest';
import { NavGrid } from '../src/controls/nav';
import { clearWalkSegment, resolveCircle } from '../src/controls/collision';
import { Player } from '../src/controls/player';

const bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
const wall = { minX: 0, maxX: .04, minZ: -1.5, maxZ: 1.5 };

describe('safe navigation beside furniture', () => {
  it('starts inside the navigation margin without crossing the obstacle', () => {
    const nav = new NavGrid([wall], bounds);
    expect(nav.isFree(-.31, 0)).toBe(false);
    const route = nav.findPath(-.31, 0, 3, 0);
    expect(route).not.toBeNull();
    let previous = {x:-.31,z:0};
    for (const point of route!) {
      expect(clearWalkSegment(previous, point, .3, [wall])).toBe(true);
      previous = point;
    }
    expect(previous).toEqual({x:3,z:0});
    expect(route!.some(p => Math.abs(p.z) > 1.8)).toBe(true);
  });
  it('does not invent an exit through an enclosing wall', () => {
    const barrier = {...wall,minZ:-5,maxZ:5};
    expect(new NavGrid([barrier],bounds).findPath(-.31,0,3,0)).toBeNull();
  });
  it('rejects starts and goals inside furniture', () => {
    const nav = new NavGrid([wall], bounds);
    expect(nav.findPath(.02,0,3,0)).toBeNull();
    expect(nav.findPath(-3,0,.02,0)).toBeNull();
    expect(nav.findPath(NaN,0,3,0)).toBeNull();
  });
  it('reaches a goal within the navigation margin by a safe final segment', () => {
    const route = new NavGrid([wall], bounds).findPath(-3,0,-.31,0)!;
    expect(route[route.length - 1]).toEqual({x:-.31,z:0});
    let previous={x:-3,z:0};
    for(const point of route) { expect(clearWalkSegment(previous,point,.3,[wall])).toBe(true); previous=point; }
  });
  it('walks the corner route at 20 FPS without penetration or becoming stuck', () => {
    const route=new NavGrid([wall],bounds).findPath(-.31,0,3,0)!;
    const player=new Player([wall]); player.x=-.31; player.z=0; player.enabled=true;
    let stuck=false; player.onAutoWalkEnd=why=>{stuck=why==='stuck';}; player.walkPath(route);
    for(let i=0;i<1200 && player.autoWalking;i++) {
      player.update(.05);
      const resolved=resolveCircle(player.x,player.z,.3,[wall]);
      expect(resolved.x).toBeCloseTo(player.x,5); expect(resolved.z).toBeCloseTo(player.z,5);
    }
    expect(stuck).toBe(false); expect(player.autoWalking).toBe(false);
    expect(Math.hypot(player.x-3,player.z)).toBeLessThan(.25);
  });
});

describe('swept body clearance', () => {
  it('detects thin glass between endpoints that are both free', () => {
    expect(clearWalkSegment({x:-2,z:0},{x:2,z:0},.3,[wall])).toBe(false);
  });
  it('allows tangent travel and detects rounded-corner collisions', () => {
    const box={minX:0,maxX:1,minZ:0,maxZ:1};
    expect(clearWalkSegment({x:-.3,z:-1},{x:-.3,z:2},.3,[box])).toBe(true);
    expect(clearWalkSegment({x:-.2,z:-.2},{x:-.2,z:-.2},.3,[box])).toBe(false);
    expect(clearWalkSegment({x:-.25,z:-.25},{x:-.25,z:-.25},.3,[box])).toBe(true);
  });
});
