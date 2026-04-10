import {
  addPoint,
  clearAll,
  createInitialState,
  endStroke,
  redo,
  startStroke,
  undo,
  type StrokePoint,
} from './brushEngine';

const p0: StrokePoint = { x: 0.2, y: 0.2, pressure: 0.7, speed: 0.01 };
const p1: StrokePoint = { x: 0.4, y: 0.4, pressure: 0.7, speed: 0.01 };

test('stroke lifecycle start/add/end', () => {
  let state = createInitialState();
  state = startStroke(state, '#fff', 10, 'ink', p0);
  state = addPoint(state, p1);
  state = endStroke(state);
  expect(state.layers.canvas.strokes.length).toBe(1);
  expect(state.layers.canvas.strokes[0].points.length).toBeGreaterThan(1);
});

test('undo/redo moves strokes between stacks', () => {
  let state = createInitialState();
  state = startStroke(state, '#fff', 10, 'ink', p0);
  state = addPoint(state, p1);
  state = endStroke(state);
  state = undo(state);
  expect(state.layers.canvas.strokes.length).toBe(0);
  expect(state.layers.canvas.redo.length).toBe(1);
  state = redo(state);
  expect(state.layers.canvas.strokes.length).toBe(1);
  expect(state.layers.canvas.redo.length).toBe(0);
});

test('clearAll resets all layers', () => {
  let state = createInitialState();
  state = startStroke(state, '#fff', 10, 'ink', p0);
  state = addPoint(state, p1);
  state = endStroke(state);
  state = clearAll(state);
  expect(state.layers.background.strokes.length).toBe(0);
  expect(state.layers.canvas.strokes.length).toBe(0);
  expect(state.layers.overlay.strokes.length).toBe(0);
});
