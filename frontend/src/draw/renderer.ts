import type { BrushEngineState, LayerState, Stroke, StrokePoint, SymmetryMode } from './brushEngine';

function hexToRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function smoothPath(ctx: CanvasRenderingContext2D, pts: StrokePoint[], w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[i - 1];
    ctx.quadraticCurveTo(prev.x * w, prev.y * h, ((prev.x + p.x) * w) / 2, ((prev.y + p.y) * h) / 2);
  }
}

function cloneStrokeWithPoints(stroke: Stroke, points: StrokePoint[]): Stroke {
  return { ...stroke, points };
}

function mirrorPoints(points: StrokePoint[], symmetry: SymmetryMode): StrokePoint[] {
  switch (symmetry) {
    case 'horizontal':
      return points.map((p) => ({ ...p, y: 1 - p.y }));
    case 'vertical':
      return points.map((p) => ({ ...p, x: 1 - p.x }));
    default:
      return points;
  }
}

function mirroredVariants(stroke: Stroke): Stroke[] {
  if (stroke.symmetry === 'off') return [stroke];
  if (stroke.symmetry === 'horizontal') return [stroke, cloneStrokeWithPoints(stroke, mirrorPoints(stroke.points, 'horizontal'))];
  if (stroke.symmetry === 'vertical') return [stroke, cloneStrokeWithPoints(stroke, mirrorPoints(stroke.points, 'vertical'))];

  const horizontal = mirrorPoints(stroke.points, 'horizontal');
  const vertical = mirrorPoints(stroke.points, 'vertical');
  const quad = horizontal.map((p) => ({ ...p, x: 1 - p.x }));
  return [
    stroke,
    cloneStrokeWithPoints(stroke, horizontal),
    cloneStrokeWithPoints(stroke, vertical),
    cloneStrokeWithPoints(stroke, quad),
  ];
}

function renderInk(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
  if (s.points.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = s.isEraser ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.isEraser ? 'rgba(0,0,0,1)' : s.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pts = s.points;
  ctx.beginPath();
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[i - 1];
    ctx.lineWidth = s.size * ((p.pressure + prev.pressure) / 2);
    ctx.quadraticCurveTo(prev.x * w, prev.y * h, ((prev.x + p.x) * w) / 2, ((prev.y + p.y) * h) / 2);
  }
  ctx.stroke();
  ctx.restore();
}

function renderNeon(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
  if (s.points.length < 2) return;
  const [r, g, b] = hexToRgb(s.color);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.shadowColor = s.color;
  ctx.shadowBlur = s.size * 3;
  ctx.strokeStyle = `rgba(${r},${g},${b},0.15)`;
  ctx.lineWidth = s.size * 2.5;
  smoothPath(ctx, s.points, w, h);
  ctx.stroke();

  ctx.shadowBlur = s.size * 1.5;
  ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`;
  ctx.lineWidth = s.size * 1.2;
  smoothPath(ctx, s.points, w, h);
  ctx.stroke();

  ctx.shadowBlur = 4;
  ctx.strokeStyle = `rgba(${r},${g},${b},0.95)`;
  ctx.lineWidth = s.size * 0.4;
  smoothPath(ctx, s.points, w, h);
  ctx.stroke();
  ctx.restore();
}

function renderWatercolor(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
  if (s.points.length < 2) return;
  const [r, g, b] = hexToRgb(s.color);
  const rng = seededRng(s.id.charCodeAt(0) * 31);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 4; pass++) {
    const ox = (rng() - 0.5) * s.size * 0.6;
    const oy = (rng() - 0.5) * s.size * 0.6;
    ctx.strokeStyle = `rgba(${r},${g},${b},${0.04 + rng() * 0.04})`;
    ctx.lineWidth = s.size * (1 + rng() * 0.8);
    ctx.filter = `blur(${s.size * 0.3}px)`;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x * w + ox, s.points[0].y * h + oy);
    for (let i = 1; i < s.points.length; i++) {
      const p = s.points[i];
      const pv = s.points[i - 1];
      ctx.quadraticCurveTo(pv.x * w + ox, pv.y * h + oy, ((pv.x + p.x) * w) / 2 + ox, ((pv.y + p.y) * h) / 2 + oy);
    }
    ctx.stroke();
  }
  ctx.filter = 'none';
  ctx.restore();
}

function renderSpray(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
  const [r, g, b] = hexToRgb(s.color);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const rng = seededRng(42);
  for (const pt of s.points) {
    if (rng() > 0.3) continue;
    const pr = pt.pressure ?? 0.6;
    const rad = s.size * 1.8 * pr;
    const dens = Math.max(4, Math.floor(s.size * 1.2));
    for (let i = 0; i < dens; i++) {
      const ang = rng() * Math.PI * 2;
      const d = rng() * rad;
      ctx.fillStyle = `rgba(${r},${g},${b},${(0.3 + rng() * 0.4) * pr})`;
      ctx.beginPath();
      ctx.arc(pt.x * w + Math.cos(ang) * d, pt.y * h + Math.sin(ang) * d, rng() * 2 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function renderCalligraphy(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
  if (s.points.length < 2) return;
  const [r, g, b] = hexToRgb(s.color);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 1; i < s.points.length; i++) {
    const pv = s.points[i - 1];
    const cu = s.points[i];
    const angle = Math.atan2(cu.y * h - pv.y * h, cu.x * w - pv.x * w);
    const wf = 0.2 + Math.abs(Math.sin(angle - Math.PI / 4)) * 1.6;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.88)`;
    ctx.lineWidth = s.size * wf * ((cu.pressure + pv.pressure) / 2);
    ctx.beginPath();
    ctx.moveTo(pv.x * w, pv.y * h);
    ctx.lineTo(cu.x * w, cu.y * h);
    ctx.stroke();
  }
  ctx.restore();
}

function renderGlitter(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rng = seededRng(s.id.charCodeAt(1) * 17);
  const hues = [0, 30, 60, 120, 180, 240, 300];
  for (const pt of s.points) {
    if (rng() > 0.4) continue;
    const pr = pt.pressure ?? 0.6;
    const sp = s.size * 1.5 * pr;
    for (let i = 0; i < 5; i++) {
      const ang = rng() * Math.PI * 2;
      const d = rng() * sp;
      const hue = hues[Math.floor(rng() * hues.length)];
      const l = 60 + rng() * 35;
      ctx.fillStyle = `hsla(${hue},100%,${l}%,${0.4 + rng() * 0.5})`;
      ctx.shadowColor = `hsl(${hue},100%,80%)`;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(pt.x * w + Math.cos(ang) * d, pt.y * h + Math.sin(ang) * d, rng() * 3 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function renderChalk(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
  if (s.points.length < 2) return;
  const [r, g, b] = hexToRgb(s.color);
  const rng = seededRng(s.id.charCodeAt(2) * 23);
  ctx.save();
  for (let i = 1; i < s.points.length; i++) {
    const pv = s.points[i - 1];
    const cu = s.points[i];
    const pr = (cu.pressure + pv.pressure) / 2;
    const n = Math.floor(8 + pr * 12);
    for (let d = 0; d < n; d++) {
      const t = d / n;
      const x = (pv.x + (cu.x - pv.x) * t) * w + (rng() - 0.5) * s.size * 0.8;
      const y = (pv.y + (cu.y - pv.y) * t) * h + (rng() - 0.5) * s.size * 0.8;
      ctx.fillStyle = `rgba(${r},${g},${b},${(0.3 + rng() * 0.5) * pr})`;
      ctx.beginPath();
      ctx.arc(x, y, rng() * s.size * 0.35 * pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawStrokeOnce(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
  if (s.isEraser) {
    renderInk(ctx, s, w, h);
    return;
  }
  switch (s.type) {
    case 'ink':
      renderInk(ctx, s, w, h);
      break;
    case 'neon':
      renderNeon(ctx, s, w, h);
      break;
    case 'watercolor':
      renderWatercolor(ctx, s, w, h);
      break;
    case 'spray':
      renderSpray(ctx, s, w, h);
      break;
    case 'calligraphy':
      renderCalligraphy(ctx, s, w, h);
      break;
    case 'glitter':
      renderGlitter(ctx, s, w, h);
      break;
    case 'chalk':
      renderChalk(ctx, s, w, h);
      break;
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
  for (const variant of mirroredVariants(s)) {
    drawStrokeOnce(ctx, variant, w, h);
  }
}

function createScratchCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function renderLayer(composite: CanvasRenderingContext2D, layer: LayerState, w: number, h: number): void {
  if (!layer.visible) return;
  const off = createScratchCanvas(w, h);
  const ctx = off.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) return;

  for (const stroke of layer.strokes) drawStroke(ctx, stroke, w, h);
  if (layer.active) drawStroke(ctx, layer.active, w, h);

  composite.save();
  composite.globalAlpha = layer.opacity;
  composite.drawImage(off as CanvasImageSource, 0, 0);
  composite.restore();
}

export function renderDrawing(ctx: CanvasRenderingContext2D, state: BrushEngineState): void {
  const { canvas } = ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const id of ['background', 'canvas', 'overlay'] as const) {
    renderLayer(ctx, state.layers[id], canvas.width, canvas.height);
  }
}

export function renderCursor(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  mode: 'draw' | 'erase' | 'hover',
  size = 7,
): void {
  const { canvas } = ctx;
  const w = canvas.width;
  const h = canvas.height;
  const cx = p.x * w;
  const cy = p.y * h;
  ctx.save();

  if (mode === 'erase') {
    ctx.strokeStyle = 'rgba(251,191,36,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, size * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (mode === 'draw') {
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(0,229,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,229,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 1.4, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

export function renderDebug(ctx: CanvasRenderingContext2D, landmarks: Array<{ x: number; y: number }>): void {
  const { canvas } = ctx;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!landmarks.length) return;

  const conns = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15],
    [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17],
  ];

  ctx.save();
  ctx.globalAlpha = 0.85;
  const hand = landmarks;
  ctx.strokeStyle = 'rgba(0,229,255,0.5)';
  ctx.lineWidth = 1.5;
  for (const [a, b] of conns) {
    if (!hand[a] || !hand[b]) continue;
    ctx.beginPath();
    ctx.moveTo(hand[a].x * w, hand[a].y * h);
    ctx.lineTo(hand[b].x * w, hand[b].y * h);
    ctx.stroke();
  }
  for (let i = 0; i < hand.length; i++) {
    const tip = [4, 8, 12, 16, 20].includes(i);
    ctx.fillStyle = tip ? '#00e5ff' : 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(hand[i].x * w, hand[i].y * h, tip ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function exportToCanvas(state: BrushEngineState, w: number, h: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  renderDrawing(ctx, state);
  return out;
}
