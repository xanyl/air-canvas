/**
 * gesture.ts — Advanced Multi-Gesture Recognition for AirCanvas 3D Studio
 *
 * 6 Gestures:
 *  ☝️  POINT   — index up only                 → hover / move cursor
 *  🤏  PINCH   — thumb+index close              → DRAW (2D) / GRAB (3D)
 *  ✌️  VICTORY — index+middle up                → ERASE (2D) / ROTATE (3D)
 *  🖐️  OPEN    — 4+ fingers up                  → neutral
 *  ✊  FIST    — all curled                     → hold in Math mode to solve
 *  🤘  ROCK    — 3 fingers up (index+middle+ring) → hold to trigger Gemini analysis
 */

export type Point = { x: number; y: number; z?: number };

export type GestureType = 'NONE' | 'POINT' | 'PINCH' | 'VICTORY' | 'OPEN' | 'FIST' | 'ROCK';

// MediaPipe landmark indices
export const WRIST       = 0;
export const THUMB_TIP   = 4;
export const THUMB_IP    = 3;
export const INDEX_TIP   = 8;
export const INDEX_PIP   = 6;
export const INDEX_MCP   = 5;
export const MIDDLE_TIP  = 12;
export const MIDDLE_PIP  = 10;
export const RING_TIP    = 16;
export const RING_PIP    = 14;
export const PINKY_TIP   = 20;
export const PINKY_PIP   = 18;

export function dist(a: Point, b: Point): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(a: Point, b: Point): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function fingerUp(tip: Point, pip: Point, threshold = 0.035): boolean {
  return tip.y < pip.y - threshold;
}

export function classifyGesture(lm: Point[]): { gesture: GestureType; confidence: number } {
  if (!lm || lm.length < 21) return { gesture: 'NONE', confidence: 0 };

  const indexUp  = fingerUp(lm[INDEX_TIP],  lm[INDEX_PIP]);
  const midUp    = fingerUp(lm[MIDDLE_TIP], lm[MIDDLE_PIP]);
  const ringUp   = fingerUp(lm[RING_TIP],   lm[RING_PIP]);
  const pinkyUp  = fingerUp(lm[PINKY_TIP],  lm[PINKY_PIP]);
  const fingerCount = [indexUp, midUp, ringUp, pinkyUp].filter(Boolean).length;

  // PINCH: normalized thumb-index distance relative to hand size
  const handSize = dist(lm[WRIST], lm[INDEX_MCP]);
  const pinchDist = dist(lm[THUMB_TIP], lm[INDEX_TIP]) / Math.max(handSize, 0.01);

  if (pinchDist < 0.38 && !midUp) {
    return { gesture: 'PINCH', confidence: 1 - pinchDist / 0.38 };
  }
  if (fingerCount >= 4) return { gesture: 'OPEN', confidence: 0.92 };
  if (indexUp && midUp && !ringUp && !pinkyUp) return { gesture: 'VICTORY', confidence: 0.90 };
  if (indexUp && midUp && ringUp && !pinkyUp)   return { gesture: 'ROCK',    confidence: 0.9 };
  if (indexUp && !midUp && !ringUp && !pinkyUp) return { gesture: 'POINT',   confidence: 0.87 };
  if (fingerCount === 0)                         return { gesture: 'FIST',    confidence: 0.82 };
  return { gesture: 'NONE', confidence: 0.5 };
}

/**
 * GestureProcessor: requires N consecutive identical frames before committing.
 * Eliminates flickering at gesture boundaries.
 */
export class GestureProcessor {
  private current: GestureType = 'NONE';
  private candidate: GestureType = 'NONE';
  private frames = 0;
  private readonly needed: number;

  constructor(confirmFrames = 3) { this.needed = confirmFrames; }

  update(lm: Point[]): { gesture: GestureType; confidence: number } {
    const { gesture, confidence } = classifyGesture(lm);
    if (gesture === this.candidate) {
      this.frames++;
      if (this.frames >= this.needed) this.current = gesture;
    } else {
      this.candidate = gesture;
      this.frames = 1;
    }
    return { gesture: this.current, confidence };
  }

  getGesture(): GestureType { return this.current; }
  reset(): void { this.current = 'NONE'; this.candidate = 'NONE'; this.frames = 0; }
}

export const GESTURE_META: Record<GestureType, { emoji: string; label: string; action2D: string; action3D: string; color: string }> = {
  NONE:    { emoji: '—',  label: 'None',       action2D: 'No hand detected',              action3D: 'No hand',              color: '#64748b' },
  POINT:   { emoji: '☝️', label: '1 Finger',   action2D: 'Hover cursor',                  action3D: 'Hover / Select',       color: '#00e5ff' },
  PINCH:   { emoji: '🤏', label: 'Pinch',      action2D: 'Draw',                          action3D: 'Grab & Move object',   color: '#10b981' },
  VICTORY: { emoji: '✌️', label: '2 Fingers',  action2D: 'Erase (2 fingers)',            action3D: 'Rotate grabbed object',color: '#f59e0b' },
  OPEN:    { emoji: '🖐️', label: 'Open Palm',  action2D: 'Neutral',                            action3D: 'Neutral',              color: '#8b5cf6' },
  FIST:    { emoji: '✊', label: 'Fist',       action2D: 'Hold in Math mode to solve',         action3D: 'Release / Deselect',   color: '#ef4444' },
  ROCK:    { emoji: '🤘', label: '3 Fingers',  action2D: 'Hold ~1s for Gemini analysis',       action3D: 'Special action',        color: '#ec4899' },
};
