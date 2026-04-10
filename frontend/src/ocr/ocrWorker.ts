/**
 * ocrWorker.ts — Web Worker for Tesseract.js OCR
 *
 * Loads Tesseract WASM lazily on first recognition request.
 * Communicates via postMessage: receives image data URL, returns recognized text.
 */

import Tesseract from 'tesseract.js';

let worker: Tesseract.Worker | null = null;

async function ensureWorker(): Promise<Tesseract.Worker> {
  if (worker) return worker;
  worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
    logger: () => {}, // silence progress logs
  });
  return worker;
}

self.onmessage = async (event: MessageEvent<{ imageDataUrl: string; id: number }>) => {
  const { imageDataUrl, id } = event.data;
  try {
    const w = await ensureWorker();
    const result = await w.recognize(imageDataUrl);
    const text = result.data.text.trim();
    const confidence = result.data.confidence;
    self.postMessage({ id, text, confidence, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OCR failed';
    self.postMessage({ id, text: '', confidence: 0, error: message });
  }
};
