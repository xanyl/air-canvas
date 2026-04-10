import { useCallback, useRef, useState } from 'react';

export function useFPS(win = 30) {
  const ts = useRef<number[]>([]);
  const [fps, setFps] = useState(0);
  const tick = useCallback(() => {
    const now = performance.now();
    ts.current.push(now);
    if (ts.current.length > win) ts.current.shift();
    if (ts.current.length >= 2) setFps(Math.round((ts.current.length - 1) / (now - ts.current[0]) * 1000));
  }, [win]);
  return { fps, tick };
}
