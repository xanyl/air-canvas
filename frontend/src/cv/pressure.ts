import type { Point } from './gesture';

const Z_NEAR = -0.12;
const Z_FAR  =  0.05;

export function zToPressure(z: number | undefined): number {
  if (z === undefined || isNaN(z as number)) return 0.6;
  const t = (Math.max(Z_NEAR, Math.min(Z_FAR, z)) - Z_NEAR) / (Z_FAR - Z_NEAR);
  return 1.0 - t * 0.8;
}

export function pressureSize(base: number, pressure: number, sensitivity = 0.5): number {
  return Math.max(1, base * (1 + (pressure - 0.6) * sensitivity * 1.4));
}

export function estimateSpeed(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Map a MediaPipe Z coordinate (-0.12..0.05) to a Three.js world-space Z offset.
 * Near camera (negative Z) → positive world Z (object moves forward/toward viewer)
 */
export function zToWorld(z: number | undefined, scale = 20): number {
  if (z === undefined || isNaN(z as number)) return 0;
  return Math.max(-3, Math.min(3, -z * scale));
}
