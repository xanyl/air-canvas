import { z } from 'zod';
import type { AnalysisMode, MathSolveResult } from '../types';

export const ANALYSIS_MODES: Array<{ id: AnalysisMode; label: string; emoji: string }> = [
  { id: 'describe', label: 'Describe', emoji: '🔍' },
  { id: 'critique', label: 'Critique', emoji: '🎨' },
  { id: 'style', label: 'Style', emoji: '✨' },
  { id: 'poem', label: 'Poem', emoji: '📜' },
];

const analyzeSchema = z.object({
  text: z.string(),
  mode: z.enum(['describe', 'critique', 'style', 'poem']),
  provider: z.enum(['openai', 'gemini']),
  model: z.string(),
  latencyMs: z.number(),
});

const solveSchema = z.object({
  expression: z.string(),
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  rawModelText: z.string(),
  provider: z.enum(['openai', 'gemini']),
  model: z.string(),
  latencyMs: z.number(),
});

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

/**
 * Fetch with automatic retry on 502 (backend upstream failure) and network errors.
 * Retries once with 800ms backoff.
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 1): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 502 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError ?? new Error('Request failed after retries');
}

async function parseResponse(res: Response): Promise<unknown> {
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      detail = (data as { detail?: string }).detail ?? detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function analyzeCanvasImage(
  imageBase64: string,
  mode: AnalysisMode,
  promptContext?: string,
): Promise<{ text: string; mode: AnalysisMode; provider: 'openai' | 'gemini'; model: string; latencyMs: number }> {
  const res = await fetchWithRetry(`${API_BASE}/api/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mode, promptContext }),
  });
  const parsed = analyzeSchema.parse(await parseResponse(res));
  return parsed;
}

export async function solveMathImage(imageBase64: string): Promise<MathSolveResult> {
  const res = await fetchWithRetry(`${API_BASE}/api/math/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  const parsed = solveSchema.parse(await parseResponse(res));
  return { ...parsed, createdAt: new Date().toISOString() };
}
