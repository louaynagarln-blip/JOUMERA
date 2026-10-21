export interface Vector2 { x: number; y: number }

/** Radial stick shaping with a quiet centre and full travel at the rim. */
export function shapeStick(x: number, y: number, deadZone = 0.1): Vector2 {
  const raw = Math.hypot(x, y);
  if (raw <= deadZone || raw === 0) return { x: 0, y: 0 };
  const clamped = Math.min(1, raw);
  const shaped = (clamped - deadZone) / (1 - deadZone);
  return { x: (x / raw) * shaped, y: (y / raw) * shaped };
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
