// Validación de las salidas estructuradas de la IA. Si algo no cumple el esquema, se rechaza: nunca avanza el flujo.
import type { Solution, Verdict } from '../core/types';
import { AIError } from './provider';

const bad = (what: string) => new AIError('format', `La respuesta de la IA no tenía el formato esperado (${what}).`);

export function extractJson(raw: string): unknown {
  const s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw bad('no es JSON');
  try { return JSON.parse(s.slice(a, b + 1)); } catch { throw bad('JSON inválido'); }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number, field: string, required = true): string | null => {
  if (v === null || v === undefined || v === '') { if (required) throw bad(field); return null; }
  if (typeof v !== 'string') throw bad(field);
  const t = v.trim();
  if (!t && required) throw bad(field);
  return t.slice(0, max) || null;
};
const strList = (v: unknown, max: number, field: string): string[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw bad(field);
  return v.map((x: string) => x.trim().slice(0, max)).filter(Boolean).slice(0, 20);
};

export type HintResult =
  | { kind: 'hint'; text: string; feedback: string | null }
  | { kind: 'clarify'; question: string };

export function parseHint(raw: string): HintResult {
  const o = extractJson(raw);
  if (!isObj(o)) throw bad('objeto');
  if (o.needsClarification === true) return { kind: 'clarify', question: str(o.clarifyingQuestion, 400, 'clarifyingQuestion')! };
  return { kind: 'hint', text: str(o.hint, 1800, 'hint')!, feedback: str(o.feedback, 800, 'feedback', false) };
}

export function parseSolution(raw: string, now: number): Solution {
  const o = extractJson(raw);
  if (!isObj(o)) throw bad('objeto');
  const steps = strList(o.steps, 800, 'steps');
  if (steps.length === 0) throw bad('steps');
  return {
    answer: str(o.answer, 600, 'answer', false),
    verified: o.verified === true,
    steps,
    connection: str(o.connection, 800, 'connection')!,
    mistakes: strList(o.mistakes, 500, 'mistakes'),
    why: str(o.why, 1200, 'why')!,
    uncertainty: str(o.uncertainty, 600, 'uncertainty', false),
    at: now,
  };
}

export function parseCheckQuestion(raw: string): { question: string; concept: string } {
  const o = extractJson(raw);
  if (!isObj(o)) throw bad('objeto');
  return { question: str(o.question, 1200, 'question')!, concept: str(o.concept, 200, 'concept')! };
}

export function parseEvaluation(raw: string): { verdict: Verdict; feedback: string; nextHint: string | null } {
  const o = extractJson(raw);
  if (!isObj(o)) throw bad('objeto');
  if (o.verdict !== 'correct' && o.verdict !== 'partial' && o.verdict !== 'incorrect') throw bad('verdict');
  return { verdict: o.verdict, feedback: str(o.feedback, 1200, 'feedback')!, nextHint: str(o.nextHint, 800, 'nextHint', false) };
}
