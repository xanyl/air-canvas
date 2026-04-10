import { useState, useCallback } from 'react';
import { loadOpenCV, isCVReady } from '../opencv/opencvLoader';

export type CVStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useOpenCV() {
  const [status, setStatus] = useState<CVStatus>(isCVReady() ? 'ready' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isCVReady()) { setStatus('ready'); return; }
    setStatus('loading');
    try {
      await loadOpenCV();
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OpenCV load failed');
      setStatus('error');
    }
  }, []);

  return { status, error, load, isReady: status === 'ready' };
}
