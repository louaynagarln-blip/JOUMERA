import { afterEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../src/controls/player';

class Surface extends EventTarget {
  style = { transform: '' };
  captures = new Set<number>();
  hidden = false;
  pointerLockElement = null;
  getBoundingClientRect() { return { width: 168, height: 168 }; }
  setPointerCapture(id: number) { this.captures.add(id); }
  hasPointerCapture(id: number) { return this.captures.has(id); }
  releasePointerCapture(id: number) { this.captures.delete(id); }
}
function pointer(target: Surface, type: string, id: number, x=100, y=100) {
  const event=new Event(type,{cancelable:true});
  Object.assign(event,{pointerId:id,pointerType:'touch',clientX:x,clientY:y}); target.dispatchEvent(event);
}
function setup() {
  const doc=new Surface(), win=new Surface(), joy=new Surface(), look=new Surface(), knob=new Surface();
  vi.stubGlobal('document',doc); vi.stubGlobal('window',win);
  const player=new Player([]); player.enabled=true;
  player.bind(look as unknown as HTMLElement,joy as unknown as HTMLElement,knob as unknown as HTMLElement,look as unknown as HTMLElement);
  const drag=()=>{pointer(joy,'pointerdown',1);pointer(joy,'pointermove',1,100,45);player.update(.1);};
  return {doc,win,joy,look,knob,player,drag};
}
afterEach(()=>vi.unstubAllGlobals());
describe('touch ownership and interruption',()=>{
  it('stop clears capture, knob and movement until a fresh touch',()=>{
    const {player,joy,knob,drag}=setup();drag();player.stop();const z=player.z;
    pointer(joy,'pointermove',1,100,20);player.update(.1);
    expect(player.z).toBe(z);expect(joy.captures.size).toBe(0);expect(knob.style.transform).toBe('translate(0,0)');
    drag();expect(player.z).toBeLessThan(z);
  });
  it('modal interruption releases both fingers and stale moves cannot resume walking',()=>{
    const {player,joy,look,drag}=setup();drag();pointer(look,'pointerdown',2);player.enabled=false;
    expect(joy.captures.size).toBe(0);expect(look.captures.size).toBe(0);
    player.enabled=true;const z=player.z;pointer(joy,'pointermove',1,100,20);player.update(.1);expect(player.z).toBe(z);
  });
  it('a second finger ending does not cancel the joystick finger',()=>{
    const {player,joy,look,drag}=setup();drag();pointer(look,'pointerdown',2);pointer(look,'pointerup',2);
    const z=player.z;player.update(.1);expect(player.z).toBeLessThan(z);expect(joy.hasPointerCapture(1)).toBe(true);
  });
  it('document pointer cancellation stops the correct finger',()=>{
    const {player,doc,drag}=setup();drag();pointer(doc,'pointercancel',1);
    for(let i=0;i<30;i++)player.update(.1);
    const z=player.z;player.update(.1);expect(player.z).toBeCloseTo(z,8);
  });
  it('orientation changes clear touch and navigation without rotating the camera',()=>{
    const {player,win,joy,drag}=setup();drag();player.pitch=.3;player.yaw=.9;
    player.walkPath([{x:0,z:-10}]);win.dispatchEvent(new Event('orientationchange'));
    expect(player.autoWalking).toBe(false);expect(joy.captures.size).toBe(0);expect(player.pitch).toBe(.3);expect(player.yaw).toBe(.9);
  });
  it('a suspended frame recentres the joystick and releases capture',()=>{
    const {player,joy,knob,drag}=setup();drag();const z=player.z;player.update(1);
    expect(player.z).toBe(z);expect(joy.captures.size).toBe(0);expect(knob.style.transform).toBe('translate(0,0)');
  });
});
