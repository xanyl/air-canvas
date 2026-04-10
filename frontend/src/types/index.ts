export type AppMode = 'draw' | 'math';

export type AnalysisMode = 'describe' | 'critique' | 'style' | 'poem';

export type MathSolveResult = {
  expression: string;
  answer: string;
  confidence: number;
  rawModelText: string;
  provider: 'openai' | 'gemini';
  model: string;
  latencyMs: number;
  createdAt: string;
};
