export type TemplatePreset = 'none' | 'grid' | 'math' | 'portrait' | 'mandala';

export const TEMPLATE_PRESETS: Array<{ id: TemplatePreset; label: string; emoji: string }> = [
  { id: 'none', label: 'None', emoji: '⬜' },
  { id: 'grid', label: 'Grid', emoji: '🔲' },
  { id: 'math', label: 'Math', emoji: '➗' },
  { id: 'portrait', label: 'Portrait', emoji: '🧑' },
  { id: 'mandala', label: 'Mandala', emoji: '🌸' },
];

export function drawTemplate(ctx: CanvasRenderingContext2D, preset: TemplatePreset): void {
  const { canvas } = ctx;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (preset === 'none') return;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;

  if (preset === 'grid' || preset === 'math') {
    const step = preset === 'math' ? 36 : 48;
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    if (preset === 'math') {
      ctx.strokeStyle = 'rgba(0,229,255,0.24)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w, h * 0.5);
      ctx.stroke();
    }
  } else if (preset === 'portrait') {
    const cx = w / 2;
    const cy = h / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy * 0.92, w * 0.16, h * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, h * 0.85);
    ctx.lineTo(cx + w * 0.2, h * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.12);
    ctx.lineTo(cx, h * 0.95);
    ctx.stroke();
  } else if (preset === 'mandala') {
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.4;
    for (let r = maxR; r > 20; r -= 40) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
      ctx.stroke();
    }
  }

  ctx.restore();
}
