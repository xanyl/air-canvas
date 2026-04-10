import type { BrushEngineState, LayerId, LayerState, Stroke } from './brushEngine';
import { exportToCanvas } from './renderer';

function cloneLayer(layer: LayerState): LayerState {
  return {
    strokes: [...layer.strokes],
    redo: [...layer.redo],
    active: layer.active,
    visible: layer.visible,
    opacity: layer.opacity,
  };
}

function emptyStateFrom(state: BrushEngineState): BrushEngineState {
  const layers = {} as Record<LayerId, LayerState>;
  (Object.keys(state.layers) as LayerId[]).forEach((id) => {
    layers[id] = {
      ...cloneLayer(state.layers[id]),
      strokes: [],
      redo: [],
      active: undefined,
    };
  });
  return { pages: [layers], currentPage: 0, layers, activeLayer: state.activeLayer };
}

function orderedStrokes(state: BrushEngineState): Array<{ layer: LayerId; stroke: Stroke }> {
  const out: Array<{ layer: LayerId; stroke: Stroke }> = [];
  for (const layer of ['background', 'canvas', 'overlay'] as LayerId[]) {
    for (const stroke of state.layers[layer].strokes) {
      out.push({ layer, stroke });
    }
  }
  out.sort((a, b) => a.stroke.createdAt - b.stroke.createdAt);
  return out;
}

export function generateReplayFrames(
  state: BrushEngineState,
  width: number,
  height: number,
  maxFrames = 40,
): string[] {
  const ordered = orderedStrokes(state);
  if (ordered.length === 0) return [];
  const seed = emptyStateFrom(state);
  const step = Math.max(1, Math.ceil(ordered.length / maxFrames));
  const frames: string[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const { layer, stroke } = ordered[i];
    seed.layers[layer].strokes.push(stroke);
    if ((i + 1) % step !== 0 && i !== ordered.length - 1) continue;
    const frame = exportToCanvas(seed, width, height);
    frames.push(frame.toDataURL('image/png'));
  }
  return frames;
}
