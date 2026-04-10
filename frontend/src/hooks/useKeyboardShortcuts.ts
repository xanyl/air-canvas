import { useEffect } from 'react';

type ShortcutHandlers = {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSaveSession: () => void;
  onToggleMode: () => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return true;
  return target.isContentEditable;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();

      if (event.metaKey || event.ctrlKey) {
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          handlers.onUndo();
          return;
        }
        if ((key === 'z' && event.shiftKey) || key === 'y') {
          event.preventDefault();
          handlers.onRedo();
          return;
        }
        if (key === 's') {
          event.preventDefault();
          handlers.onSaveSession();
          return;
        }
      }

      if (key === 'c') {
        handlers.onClear();
      } else if (key === 'm') {
        handlers.onToggleMode();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
