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

export type PageLayers = Record<LayerId, LayerState>;

export type BrushEngineState = {
  pages: PageLayers[];
  currentPage: number;
  layers: PageLayers; // always === pages[currentPage], kept for backward compatibility
  activeLayer: LayerId;
};

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function makeLayer(): LayerState {
  return { strokes: [], redo: [], active: undefined, visible: true, opacity: 1 };
}

function makePage(): PageLayers {
  return { background: makeLayer(), canvas: makeLayer(), overlay: makeLayer() };
}

export function createInitialState(): BrushEngineState {
  const page = makePage();
  return { pages: [page], currentPage: 0, layers: page, activeLayer: 'canvas' };
}

/**
 * Migrate legacy state (pre-pages) to the new format.
 * Old sessions stored `layers` without `pages`/`currentPage`.
 */
export function migrateState(s: BrushEngineState): BrushEngineState {
  if (s.pages && s.pages.length > 0) return s;
  return { ...s, pages: [s.layers], currentPage: 0 };
}

function applyToActive(s: BrushEngineState, fn: (l: LayerState) => LayerState): BrushEngineState {
  const id = s.activeLayer;
  const newLayers: PageLayers = { ...s.layers, [id]: fn(s.layers[id]) };
  const newPages = [...s.pages];
  newPages[s.currentPage] = newLayers;
  return { ...s, pages: newPages, layers: newLayers };
}

export function setActiveLayer(s: BrushEngineState, id: LayerId): BrushEngineState {
  return { ...s, activeLayer: id };
}

export function toggleLayerVisibility(s: BrushEngineState, id: LayerId): BrushEngineState {
  const newLayers: PageLayers = { ...s.layers, [id]: { ...s.layers[id], visible: !s.layers[id].visible } };
  const newPages = [...s.pages];
  newPages[s.currentPage] = newLayers;
  return { ...s, pages: newPages, layers: newLayers };
}

export function setLayerOpacity(s: BrushEngineState, id: LayerId, opacity: number): BrushEngineState {
  const newLayers: PageLayers = {
    ...s.layers,
    [id]: { ...s.layers[id], opacity: Math.max(0, Math.min(1, opacity)) },
  };
  const newPages = [...s.pages];
  newPages[s.currentPage] = newLayers;
  return { ...s, pages: newPages, layers: newLayers };
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
    {} as PageLayers,
  );
  const newPages = [...s.pages];
  newPages[s.currentPage] = cleared;
  return { ...s, pages: newPages, layers: cleared };
}

export function getAllStrokes(state: BrushEngineState): Stroke[] {
  return (Object.keys(state.layers) as LayerId[]).flatMap((id) => state.layers[id].strokes);
}

export function countStrokes(state: BrushEngineState): number {
  return getAllStrokes(state).length;
}

// ── Multi-page navigation ──────────────────────────────────────────

export function getPageCount(state: BrushEngineState): number {
  return state.pages.length;
}

export function addPage(s: BrushEngineState): BrushEngineState {
  const page = makePage();
  const newPages = [...s.pages, page];
  const newIndex = newPages.length - 1;
  return { ...s, pages: newPages, currentPage: newIndex, layers: page };
}

export function goToPage(s: BrushEngineState, index: number): BrushEngineState {
  if (index < 0 || index >= s.pages.length || index === s.currentPage) return s;
  return { ...s, currentPage: index, layers: s.pages[index] };
}

export function deletePage(s: BrushEngineState, index: number): BrushEngineState {
  if (s.pages.length <= 1) return s; // must keep at least one page
  const newPages = s.pages.filter((_, i) => i !== index);
  const newIndex = Math.min(s.currentPage, newPages.length - 1);
  return { ...s, pages: newPages, currentPage: newIndex, layers: newPages[newIndex] };
}
