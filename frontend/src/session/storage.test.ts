import { beforeEach, expect, test } from 'vitest';
import { deleteSession, loadSessions, saveSession } from './storage';
import { createInitialState } from '../draw/brushEngine';
import { computeAnalytics } from './analytics';

beforeEach(() => {
  localStorage.clear();
});

test('saveSession persists and loadSessions returns records', () => {
  const state = createInitialState();
  saveSession({
    name: 'Session A',
    notes: 'notes',
    previewDataUrl: 'data:image/png;base64,abc',
    brushState: state,
    mathHistory: [],
    analytics: computeAnalytics(state),
  });

  const sessions = loadSessions();
  expect(sessions.length).toBe(1);
  expect(sessions[0].name).toBe('Session A');
});

test('deleteSession removes by id', () => {
  const state = createInitialState();
  const s = saveSession({
    name: 'Session B',
    notes: '',
    previewDataUrl: 'data:image/png;base64,abc',
    brushState: state,
    mathHistory: [],
    analytics: computeAnalytics(state),
  });
  const remaining = deleteSession(s.id);
  expect(remaining).toHaveLength(0);
});
