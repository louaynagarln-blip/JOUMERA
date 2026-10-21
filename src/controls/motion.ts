export interface Vector2 { x: number; y: number }

/** Radial stick shaping with a quiet centre and full travel at the rim. */
export function shapeStick(x: number, y: number, deadZone = 0.1): Vector2 {
  const raw = Math.hypot(x, y);
  if (raw <= deadZone || raw === 0) return { x: 0, y: 0 };
  const clamped = Math.min(1, raw);
  const shaped = (clamped - deadZone) / (1 - deadZone);
  return { x: (x / raw) * shaped, y: (y / raw) * shaped };
}

/** Convert drag from the actual pointer-down point rather than the pad centre. */
export function stickFromOrigin(x: number, y: number, originX: number, originY: number, radius: number): Vector2 {
  const safeRadius = Math.max(1, radius);
  let dx = x - originX, dy = y - originY;
  const length = Math.hypot(dx, dy);
  if (length > safeRadius) { dx = dx / length * safeRadius; dy = dy / length * safeRadius; }
  return { x: dx, y: dy };
}

/** Frame-rate independent first-order response, used for gentle starts and stops. */
export function approach(current: number, target: number, dt: number, rate: number): number {
  const step = 1 - Math.exp(-Math.max(0, rate) * Math.min(0.05, Math.max(0, dt)));
  return current + (target - current) * step;
}

/** Shortest-path angle response; the output never jumps across the +/- PI seam. */
export function approachAngle(current: number, target: number, dt: number, rate: number): number {
  const delta = ((target - current + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return current + delta * (1 - Math.exp(-Math.max(0, rate) * Math.min(0.05, Math.max(0, dt))));
}
