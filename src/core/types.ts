export type Mode = 'strict' | 'flexible';
export type Stage = 'attempt' | 'hint1' | 'hint2' | 'hint3' | 'solution' | 'check' | 'done';
export type ProviderId = 'anthropic' | 'openai' | 'gemini';
export type HintLevel = 1 | 2 | 3;
export type Verdict = 'correct' | 'partial' | 'incorrect';
export type Subject =
  | 'auto' | 'math' | 'programming' | 'physics' | 'chemistry' | 'biology' | 'history' | 'languages' | 'other';
export type StudentLevel = 'eso' | 'bachillerato' | 'universidad';

export interface Attempt { text: string; at: number; afterHint: 0 | 1 | 2 | 3 }
export interface Hint { level: HintLevel; variant: number; text: string; feedback: string | null; at: number }
export interface Solution {
  answer: string | null;
  verified: boolean;
  steps: string[];
  connection: string;
  mistakes: string[];
  why: string;
  uncertainty: string | null;
  at: number;
}
export interface CheckRound { answer: string; verdict: Verdict; feedback: string; at: number }
export interface Check { question: string; concept: string; rounds: CheckRound[]; passed: boolean }

export interface Exercise {
  id: string;
  prompt: string;
  context: string;
  subject: Subject;
  /** El modo se fija al crear el ejercicio: cambiarlo en ajustes no afloja un ejercicio en curso. */
  mode: Mode;
  stage: Stage;
  status: 'active' | 'completed';
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  draft: string;
  restarts: number;
  attempts: Attempt[];
  hints: Hint[];
  solution: Solution | null;
  check: Check | null;
  pendingClarification: string | null;
}

export interface Settings {
  provider: ProviderId;
  models: Record<ProviderId, string>;
  mode: Mode;
  level: StudentLevel;
  theme: 'auto' | 'dark' | 'light';
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'anthropic',
  models: { anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o-mini', gemini: 'gemini-3.8-flash' },
  mode: 'strict',
  level: 'bachillerato',
  theme: 'dark',
};
