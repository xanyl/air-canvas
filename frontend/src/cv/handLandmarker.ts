import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export type HandLandmarkerConfig = {
  wasmRoot?: string;
  modelAssetPath: string;
  numHands?: number;
  delegate?: 'CPU' | 'GPU';
};

export async function createHandLandmarker(cfg: HandLandmarkerConfig) {
  const wasmRoot =
    cfg.wasmRoot ??
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

  const vision = await FilesetResolver.forVisionTasks(wasmRoot);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: cfg.modelAssetPath,
      delegate: cfg.delegate ?? 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: cfg.numHands ?? 2,  // two-hand support
  });
}
