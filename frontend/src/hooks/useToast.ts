import { useCallback, useRef, useState } from 'react';
export type Toast = { id: number; message: string };
let _id = 0;
export function useToast(duration = 2200) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const show = useCallback((message: string) => {
    const id = ++_id;
    setToasts(p => [...p.slice(-2), { id, message }]);
    timers.current.set(id, setTimeout(() => {
      setToasts(p => p.filter(t => t.id !== id));
      timers.current.delete(id);
    }, duration));
  }, [duration]);
  return { toasts, show };
}
