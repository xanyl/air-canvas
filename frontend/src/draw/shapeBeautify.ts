import type { Stroke, StrokePoint } from './brushEngine';

type BBox = { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number };

function bbox(points: StrokePoint[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function lineFitError(points: StrokePoint[]): number {
  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  let sum = 0;
  for (const p of points) {
    const dist = Math.abs(dy * p.x - dx * p.y + end.x * start.y - end.y * start.x) / len;
    sum += dist;
  }
  return sum / points.length;
}

function makePoint(base: StrokePoint, x: number, y: number): StrokePoint {
  return { ...base, x, y };
}

function makeLine(points: StrokePoint[]): StrokePoint[] {
  const start = points[0];
  const end = points[points.length - 1];
  const out: StrokePoint[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    out.push(makePoint(start, start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t));
  }
  return out;
}

function makeRectangle(points: StrokePoint[]): StrokePoint[] {
  const b = bbox(points);
  const base = points[0];
  const corners: [number, number][] = [
    [b.minX, b.minY],
    [b.maxX, b.minY],
    [b.maxX, b.maxY],
    [b.minX, b.maxY],
    [b.minX, b.minY],
  ];
  const out: StrokePoint[] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const [sx, sy] = corners[i];
    const [ex, ey] = corners[i + 1];
    for (let step = 0; step < 8; step++) {
      const t = step / 8;
      out.push(makePoint(base, sx + (ex - sx) * t, sy + (ey - sy) * t));
    }
  }
  out.push(makePoint(base, b.minX, b.minY));
  return out;
}

function makeCircle(points: StrokePoint[]): StrokePoint[] {
  const b = bbox(points);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const rx = b.w / 2;
  const ry = b.h / 2;
  const base = points[0];
  const out: StrokePoint[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    out.push(makePoint(base, cx + Math.cos(t) * rx, cy + Math.sin(t) * ry));
  }
  return out;
}

function closeness(points: StrokePoint[]): number {
  const s = points[0];
  const e = points[points.length - 1];
  return Math.hypot(e.x - s.x, e.y - s.y);
}

export function beautifyStroke(stroke: Stroke): Stroke {
  if (stroke.isEraser || stroke.points.length < 12) return stroke;
  const points = stroke.points;
  const b = bbox(points);
  if (b.w < 0.03 || b.h < 0.03) return stroke;

  const lineError = lineFitError(points);
  if (lineError < 0.006) {
    return { ...stroke, points: makeLine(points) };
  }

  const loopClosed = closeness(points) < 0.05;
  if (!loopClosed) return stroke;

  const ratio = b.w / Math.max(b.h, 1e-6);
  if (ratio > 0.75 && ratio < 1.25) {
    return { ...stroke, points: makeCircle(points) };
  }

  return { ...stroke, points: makeRectangle(points) };
}
