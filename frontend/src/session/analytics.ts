import type { BrushEngineState, BrushType, LayerId } from '../draw/brushEngine';

export type SessionAnalytics = {
  totalStrokes: number;
  totalPoints: number;
  eraserStrokes: number;
  averagePointsPerStroke: number;
  brushUsage: Record<BrushType, number>;
  layerUsage: Record<LayerId, number>;
};

export function computeAnalytics(state: BrushEngineState): SessionAnalytics {
  const brushUsage: Record<BrushType, number> = {
    ink: 0,
    neon: 0,
    watercolor: 0,
    spray: 0,
    calligraphy: 0,
    glitter: 0,
    chalk: 0,
  };
  const layerUsage: Record<LayerId, number> = {
    background: 0,
    canvas: 0,
    overlay: 0,
  };

  let totalStrokes = 0;
  let totalPoints = 0;
  let eraserStrokes = 0;

  for (const layer of ['background', 'canvas', 'overlay'] as LayerId[]) {
    for (const stroke of state.layers[layer].strokes) {
      totalStrokes += 1;
      totalPoints += stroke.points.length;
      brushUsage[stroke.type] += 1;
      layerUsage[layer] += 1;
      if (stroke.isEraser) eraserStrokes += 1;
    }
  }

  return {
    totalStrokes,
    totalPoints,
    eraserStrokes,
    averagePointsPerStroke: totalStrokes > 0 ? totalPoints / totalStrokes : 0,
    brushUsage,
    layerUsage,
  };
}
