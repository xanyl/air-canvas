import { GestureProcessor, classifyGesture, type Point } from './gesture';

function buildLandmarks(overrides: Partial<Record<number, Point>> = {}): Point[] {
  const base = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  Object.entries(overrides).forEach(([idx, point]) => {
    base[Number(idx)] = point as Point;
  });
  return base;
}

test('classifyGesture detects pinch', () => {
  const lm = buildLandmarks({
    0: { x: 0.5, y: 0.8 },
    5: { x: 0.6, y: 0.6 },
    4: { x: 0.52, y: 0.5 },
    8: { x: 0.53, y: 0.5 },
    10: { x: 0.6, y: 0.6 },
    12: { x: 0.6, y: 0.7 },
  });
  expect(classifyGesture(lm).gesture).toBe('PINCH');
});

test('gesture processor debounces to stable output', () => {
  const processor = new GestureProcessor(3);
  const openHand = buildLandmarks({
    8: { x: 0.5, y: 0.2 },
    6: { x: 0.5, y: 0.4 },
    12: { x: 0.55, y: 0.2 },
    10: { x: 0.55, y: 0.4 },
    16: { x: 0.6, y: 0.2 },
    14: { x: 0.6, y: 0.4 },
    20: { x: 0.65, y: 0.2 },
    18: { x: 0.65, y: 0.4 },
  });
  expect(processor.update(openHand).gesture).toBe('NONE');
  expect(processor.update(openHand).gesture).toBe('NONE');
  expect(processor.update(openHand).gesture).toBe('OPEN');
});
