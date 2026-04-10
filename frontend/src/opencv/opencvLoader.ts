/**
 * opencvLoader.ts — Lazy-load OpenCV.js (WASM) from CDN on demand.
 *
 * OpenCV.js is ~8 MB — we only load it when the user enables CV features.
 * The module resolves a promise once `cv` is ready on `window`.
 */

declare global {
  interface Window {
    cv: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    Module: { onRuntimeInitialized?: () => void };
  }
}

let _promise: Promise<void> | null = null;
let _ready = false;

export function isCVReady(): boolean {
  return _ready;
}

export function getCV(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!_ready) throw new Error('OpenCV.js not loaded yet. Call loadOpenCV() first.');
  return window.cv;
}

/**
 * Load OpenCV.js from CDN.
 * Safe to call multiple times — returns the same promise.
 */
export function loadOpenCV(): Promise<void> {
  if (_promise) return _promise;
  if (_ready) return Promise.resolve();

  _promise = new Promise<void>((resolve, reject) => {
    // OpenCV.js calls this when WASM is ready
    window.Module = {
      onRuntimeInitialized() {
        _ready = true;
        resolve();
      },
    };

    const cdnUrl =
      document.querySelector<HTMLMetaElement>('meta[name="opencv-cdn"]')?.content ??
      'https://docs.opencv.org/4.9.0/opencv.js';

    const script = document.createElement('script');
    script.src = cdnUrl;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load OpenCV.js from CDN'));
    document.head.appendChild(script);

    // Fallback: some builds fire cv.ready instead of onRuntimeInitialized
    const check = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        clearInterval(check);
        _ready = true;
        resolve();
      }
    }, 200);

    // 30s timeout
    setTimeout(() => {
      clearInterval(check);
      if (!_ready) reject(new Error('OpenCV.js load timed out'));
    }, 30_000);
  });

  return _promise;
}
