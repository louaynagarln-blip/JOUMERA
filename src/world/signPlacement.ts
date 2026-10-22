/** Face nearest the atrium, offset 15 mm so text cannot sink into its opaque backing. */
export function frontFaceX(minX: number, maxX: number, side: -1 | 1): number {
  return side === 1 ? minX - .015 : maxX + .015;
}
