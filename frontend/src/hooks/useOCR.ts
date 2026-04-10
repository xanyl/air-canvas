import { useCallback, useEffect, useRef, useState } from 'react';

export type OcrStatus = 'idle' | 'loading' | 'recognizing' | 'done' | 'error';

export type OcrResult = {
  text: string;
  confidence: number;
};

let _reqId = 0;

/**
 * useOCR — hook that manages a Tesseract.js Web Worker for OCR.
 *
 * Usage:
 *   const { recognize, status, result } = useOCR();
 *   await recognize(canvasElement);
 *   // result.text is now the recognized text
 */
export function useOCR() {
  const workerRef = useRef<Worker | null>(null);
  const resolversRef = useRef<Map<number, { resolve: (r: OcrResult) => void; reject: (e: Error) => void }>>(new Map());
  const [status, setStatus] = useState<OcrStatus>('idle');
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL('../ocr/ocrWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (event: MessageEvent<{ id: number; text: string; confidence: number; error: string | null }>) => {
      const { id, text, confidence, error: errMsg } = event.data;
      const entry = resolversRef.current.get(id);
      if (!entry) return;
      resolversRef.current.delete(id);
      if (errMsg) {
        setStatus('error');
        setError(errMsg);
        entry.reject(new Error(errMsg));
      } else {
        const res: OcrResult = { text, confidence };
        setResult(res);
        setStatus('done');
        setError(null);
        entry.resolve(res);
      }
    };
    workerRef.current = w;
    return w;
  }, []);

  const recognize = useCallback(async (canvas: HTMLCanvasElement): Promise<OcrResult> => {
    const w = ensureWorker();
    const dataUrl = canvas.toDataURL('image/png');
    const id = ++_reqId;
    setStatus('recognizing');
    setError(null);

    return new Promise<OcrResult>((resolve, reject) => {
      resolversRef.current.set(id, { resolve, reject });
      w.postMessage({ imageDataUrl: dataUrl, id });
    });
  }, [ensureWorker]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return { recognize, status, result, error };
}
