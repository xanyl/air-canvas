import type { BrushEngineState } from '../draw/brushEngine';
import type { MathSolveResult } from '../types';
import type { SessionAnalytics } from './analytics';

const STORAGE_KEY = 'aircanvas_sessions_v1';

export type SessionRecord = {
  id: string;
  name: string;
  notes: string;
  previewDataUrl: string;
  createdAt: string;
  updatedAt: string;
  brushState: BrushEngineState;
  mathHistory: MathSolveResult[];
  analytics: SessionAnalytics;
};

function nowIso(): string {
  return new Date().toISOString();
}

function uid(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadSessions(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionRecord[];
    return parsed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function persist(records: SessionRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function saveSession(input: Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt'>): SessionRecord {
  const sessions = loadSessions();
  const record: SessionRecord = {
    ...input,
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const merged = [record, ...sessions];
  persist(merged);
  return record;
}

export function deleteSession(id: string): SessionRecord[] {
  const sessions = loadSessions().filter((s) => s.id !== id);
  persist(sessions);
  return sessions;
}
