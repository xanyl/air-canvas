import type { Point } from '../cv/gesture';

export type BrushType = 'ink' | 'neon' | 'watercolor' | 'spray' | 'calligraphy' | 'glitter' | 'chalk';
export type SymmetryMode = 'off' | 'horizontal' | 'vertical' | 'quad';

export const BRUSH_TYPES: BrushType[] = ['ink', 'neon', 'watercolor', 'spray', 'calligraphy', 'glitter', 'chalk'];
export const BRUSH_META: Record<BrushType, { emoji: string; label: string }> = {
  ink: { emoji: '🖊️', label: 'Ink' },
  neon: { emoji: '💡', label: 'Neon' },
  watercolor: { emoji: '🎨', label: 'Water' },
  spray: { emoji: '💨', label: 'Spray' },
  calligraphy: { emoji: '✒️', label: 'Callig' },
  glitter: { emoji: '✨', label: 'Glitter' },
  chalk: { emoji: '🪨', label: 'Chalk' },
};

export type StrokePoint = Point & { pressure: number; speed: number };

export type Stroke = {
  id: string;
  color: string;
  size: number;
  type: BrushType;
  points: StrokePoint[];
  symmetry: SymmetryMode;
  isEraser?: boolean;
  createdAt: number;
};

export type LayerId = 'background' | 'canvas' | 'overlay';

export const LAYERS: { id: LayerId; name: string; color: string }[] = [
  { id: 'background', name: 'Background', color: '#3b82f6' },
  { id: 'canvas', name: 'Canvas', color: '#10b981' },
  { id: 'overlay', name: 'Overlay', color: '#8b5cf6' },
];

export type LayerState = {
  strokes: Stroke[];
  redo: Stroke[];
  active?: Stroke;
  visible: boolean;
  opacity: number;
};

export type BrushEngineState = {
  layers: Record<LayerId, LayerState>;
  activeLayer: LayerId;
};

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function makeLayer(): LayerState {
  return { strokes: [], redo: [], active: undefined, visible: true, opacity: 1 };
}

export function createInitialState(): BrushEngineState {
  return { layers: { background: makeLayer(), canvas: makeLayer(), overlay: makeLayer() }, activeLayer: 'canvas' };
}

function applyToActive(s: BrushEngineState, fn: (l: LayerState) => LayerState): BrushEngineState {
  const id = s.activeLayer;
  return { ...s, layers: { ...s.layers, [id]: fn(s.layers[id]) } };
}

export function setActiveLayer(s: BrushEngineState, id: LayerId): BrushEngineState {
  return { ...s, activeLayer: id };
}

export function toggleLayerVisibility(s: BrushEngineState, id: LayerId): BrushEngineState {
  return { ...s, layers: { ...s.layers, [id]: { ...s.layers[id], visible: !s.layers[id].visible } } };
}

export function setLayerOpacity(s: BrushEngineState, id: LayerId, opacity: number): BrushEngineState {
  return {
    ...s,
    layers: {
      ...s.layers,
      [id]: { ...s.layers[id], opacity: Math.max(0, Math.min(1, opacity)) },
    },
  };
}

export function startStroke(
  s: BrushEngineState,
  color: string,
  size: number,
  type: BrushType,
  p: StrokePoint,
  isEraser = false,
  symmetry: SymmetryMode = 'off',
): BrushEngineState {
  return applyToActive(s, (l) => ({
    ...l,
    redo: [],
    active: { id: uid(), color, size, type, points: [p], isEraser, symmetry, createdAt: Date.now() },
  }));
}

export function addPoint(s: BrushEngineState, p: StrokePoint, maxStep = 0.01): BrushEngineState {
  return applyToActive(s, (l) => {
    if (!l.active) return l;
    const pts = l.active.points;
    const last = pts[pts.length - 1];
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / maxStep));
    const newPts: StrokePoint[] = [];
    for (let i = 1; i <= steps; i++) {
      newPts.push({
        x: last.x + (dx * i) / steps,
        y: last.y + (dy * i) / steps,
        z: p.z,
        pressure: last.pressure + ((p.pressure - last.pressure) * i) / steps,
        speed: p.speed,
      });
    }
    return { ...l, active: { ...l.active, points: pts.concat(newPts) } };
  });
}

export function endStroke(
  s: BrushEngineState,
  transform?: (stroke: Stroke) => Stroke,
): BrushEngineState {
  return applyToActive(s, (l) => {
    if (!l.active) return l;
    const finalStroke = transform ? transform(l.active) : l.active;
    if (finalStroke.points.length < 2) return { ...l, active: undefined };
    return { ...l, strokes: l.strokes.concat(finalStroke), active: undefined, redo: [] };
  });
}

export function cancelActiveStroke(s: BrushEngineState): BrushEngineState {
  return applyToActive(s, (l) => ({ ...l, active: undefined }));
}

export function undo(s: BrushEngineState): BrushEngineState {
  return applyToActive(s, (l) => {
    if (l.active) return { ...l, active: undefined };
    const last = l.strokes[l.strokes.length - 1];
    if (!last) return l;
    return {
      ...l,
      strokes: l.strokes.slice(0, -1),
      redo: l.redo.concat(last),
    };
  });
}

export function redo(s: BrushEngineState): BrushEngineState {
  return applyToActive(s, (l) => {
    const lastRedo = l.redo[l.redo.length - 1];
    if (!lastRedo) return l;
    return {
      ...l,
      redo: l.redo.slice(0, -1),
      strokes: l.strokes.concat(lastRedo),
    };
  });
}

export function clearAll(s: BrushEngineState): BrushEngineState {
  const cleared = (Object.keys(s.layers) as LayerId[]).reduce(
    (acc, id) => {
      acc[id] = { ...s.layers[id], strokes: [], redo: [], active: undefined };
      return acc;
    },
    {} as Record<LayerId, LayerState>,
  );
  return { ...s, layers: cleared };
}

export function getAllStrokes(state: BrushEngineState): Stroke[] {
  return (Object.keys(state.layers) as LayerId[]).flatMap((id) => state.layers[id].strokes);
}

export function countStrokes(state: BrushEngineState): number {
  return getAllStrokes(state).length;
}
