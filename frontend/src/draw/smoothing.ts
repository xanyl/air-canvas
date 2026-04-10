import type { Point } from '../cv/gesture';

export function ema(prev: Point, next: Point, alpha: number): Point {
  return {
    x: alpha * next.x + (1 - alpha) * prev.x,
    y: alpha * next.y + (1 - alpha) * prev.y,
    z: next.z,
  };
}

export function adaptiveEma(prev: Point, next: Point, base: number, maxA = 0.85, scale = 12): Point {
  const dx = next.x - prev.x, dy = next.y - prev.y;
  const speed = Math.sqrt(dx * dx + dy * dy);
  const alpha = base + (maxA - base) * Math.min(1, speed * scale);
  return ema(prev, next, alpha);
}

export class OneEuroFilter {
  private px: number;
  private py: number;
  private pdx = 0;
  private pdy = 0;
  private pt  = 0;
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;

  constructor(init: Point, minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.px = init.x; this.py = init.y;
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    return 1.0 / (1.0 + 1.0 / (2 * Math.PI * cutoff * dt));
  }

  filter(p: Point, ts: number): Point {
    const dt = this.pt === 0 ? 0.016 : Math.max(0.001, ts - this.pt);
    this.pt = ts;
    const dx = (p.x - this.px) / dt, dy = (p.y - this.py) / dt;
    const ad = this.alpha(this.dCutoff, dt);
    const sdx = ad * dx + (1 - ad) * this.pdx;
    const sdy = ad * dy + (1 - ad) * this.pdy;
    this.pdx = sdx; this.pdy = sdy;
    const speed = Math.sqrt(sdx * sdx + sdy * sdy);
    const a = this.alpha(this.minCutoff + this.beta * speed, dt);
    const fx = a * p.x + (1 - a) * this.px;
    const fy = a * p.y + (1 - a) * this.py;
    this.px = fx; this.py = fy;
    return { x: fx, y: fy, z: p.z };
  }

  reset(p: Point): void { this.px = p.x; this.py = p.y; this.pdx = 0; this.pdy = 0; this.pt = 0; }
}
