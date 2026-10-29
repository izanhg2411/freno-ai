// Máquina de estados del método FRENO. Es la ÚNICA autoridad sobre qué etapa puede ocurrir.
// La interfaz y la IA proponen; esta lógica valida. Todas las funciones son puras e inmutables.
import type { Attempt, Exercise, HintLevel, Mode, Solution, Stage, Subject, Verdict } from './types';

export type FlowErrorCode =
  | 'WRONG_STAGE' | 'LOCKED' | 'EMPTY_ATTEMPT' | 'DUPLICATE_ATTEMPT' | 'COMPLETED' | 'INVALID';

export class FlowError extends Error {
  constructor(public readonly code: FlowErrorCode, message: string) {
    super(message);
    this.name = 'FlowError';
  }
}

export type Request = 'hint1' | 'hint2' | 'hint3' | 'rephrase' | 'solution' | 'check';
export type Gate = { ok: true } | { ok: false; code: FlowErrorCode; reason: string };

const ok: Gate = { ok: true };
const no = (code: FlowErrorCode, reason: string): Gate => ({ ok: false, code, reason });

export function hintLevel(stage: Stage): 0 | 1 | 2 | 3 {
  return stage === 'hint1' ? 1 : stage === 'hint2' ? 2 : stage === 'hint3' ? 3 : 0;
}

const hasRetryAfter = (ex: Exercise, level: number) => ex.attempts.some((a) => a.afterHint === level);

/** Un intento válido tiene contenido real; no se juzga el esfuerzo por la longitud. */
export function isMeaningfulText(text: string): boolean {
  const t = text.trim();
  return /[\p{L}\p{N}]/u.test(t);
}

/** ¿Puede pedirse ahora esta ayuda? Se consulta ANTES de llamar a la IA, así la solución ni se solicita. */
export function canRequest(ex: Exercise, req: Request): Gate {
  if (ex.status === 'completed') return no('COMPLETED', 'Este ejercicio ya está terminado.');
  const strict = ex.mode === 'strict';
  switch (req) {
    case 'hint1':
      if (ex.stage !== 'attempt') return no('WRONG_STAGE', 'La pista 1 ya se ha pedido.');
      return ex.attempts.length > 0 ? ok : no('LOCKED', 'Escribe tu intento para desbloquear la primera pista.');
    case 'hint2':
    case 'hint3': {
      const level: HintLevel = req === 'hint2' ? 2 : 3;
      if (ex.stage !== `hint${level - 1}`) return no('WRONG_STAGE', 'Las pistas se piden en orden.');
      if (strict && !hasRetryAfter(ex, level - 1))
        return no('LOCKED', `Vuelve a intentarlo tras la pista ${level - 1} para desbloquear la siguiente.`);
      return ok;
    }
    case 'rephrase':
      if (strict) return no('LOCKED', 'El modo estricto no incluye reformulaciones.');
      return hintLevel(ex.stage) > 0 ? ok : no('WRONG_STAGE', 'Solo puedes pedirlo mientras ves una pista.');
    case 'solution':
      if (strict) {
        if (ex.stage !== 'hint3') return no('LOCKED', 'La solución se desbloquea tras la pista 3 y un nuevo intento.');
        return hasRetryAfter(ex, 3) ? ok : no('LOCKED', 'Inténtalo una vez más tras la pista 3 para ver la solución.');
      }
      if (ex.stage !== 'hint2' && ex.stage !== 'hint3')
        return no('LOCKED', 'La solución se desbloquea tras la pista 2.');
      return ex.attempts.length >= 2 ? ok : no('LOCKED', 'Haz al menos un nuevo intento antes de ver la solución.');
    case 'check':
      return ex.stage === 'solution' && ex.solution ? ok : no('WRONG_STAGE', 'La comprobación llega tras la solución.');
  }
}

function assertGate(g: Gate): void {
  if (!g.ok) throw new FlowError(g.code, g.reason);
}

const touch = (ex: Exercise, now: number): Exercise => ({ ...ex, updatedAt: now });

export interface NewExerciseInput {
  prompt: string; context?: string; subject?: Subject; mode: Mode; now: number; id: string;
}

export function newExercise(i: NewExerciseInput): Exercise {
  const prompt = i.prompt.trim();
  if (prompt.length < 5) throw new FlowError('INVALID', 'El enunciado es demasiado corto.');
  return {
    id: i.id, prompt, context: (i.context ?? '').trim(), subject: i.subject ?? 'auto', mode: i.mode,
    stage: 'attempt', status: 'active', createdAt: i.now, updatedAt: i.now, completedAt: null,
    draft: '', restarts: 0, attempts: [], hints: [], solution: null, check: null, pendingClarification: null,
  };
}

export function submitAttempt(ex: Exercise, text: string, now: number): Exercise {
  if (ex.status === 'completed') throw new FlowError('COMPLETED', 'Este ejercicio ya está terminado.');
  const level = hintLevel(ex.stage);
  if (ex.stage !== 'attempt' && level === 0) throw new FlowError('WRONG_STAGE', 'Ahora no se aceptan intentos.');
  if (!isMeaningfulText(text)) throw new FlowError('EMPTY_ATTEMPT', 'Escribe tu intento, aunque sea breve o incompleto.');
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const last = ex.attempts[ex.attempts.length - 1];
  if (last && last.afterHint === level && norm(last.text) === norm(text))
    throw new FlowError('DUPLICATE_ATTEMPT', 'Es igual que tu intento anterior. Prueba a cambiar algo.');
  const attempt: Attempt = { text: text.trim(), at: now, afterHint: level };
  return { ...touch(ex, now), attempts: [...ex.attempts, attempt], draft: '', pendingClarification: null };
}

export function setClarification(ex: Exercise, question: string, now: number): Exercise {
  assertGate(canRequest(ex, 'hint1'));
  return { ...touch(ex, now), pendingClarification: question };
}

export function addContext(ex: Exercise, extra: string, now: number): Exercise {
  if (!isMeaningfulText(extra)) throw new FlowError('INVALID', 'Añade algún dato para aclarar el ejercicio.');
  const context = ex.context ? `${ex.context}\n${extra.trim()}` : extra.trim();
  return { ...touch(ex, now), context, pendingClarification: null };
}

export function applyHint(
  ex: Exercise, req: 'hint1' | 'hint2' | 'hint3' | 'rephrase',
  hint: { text: string; feedback: string | null }, now: number,
): Exercise {
  assertGate(canRequest(ex, req));
  const level = (req === 'rephrase' ? hintLevel(ex.stage) : Number(req.slice(4))) as HintLevel;
  const variant = ex.hints.filter((h) => h.level === level).length;
  const stage: Stage = req === 'rephrase' ? ex.stage : (`hint${level}` as Stage);
  return {
    ...touch(ex, now), stage, pendingClarification: null,
    hints: [...ex.hints, { level, variant, text: hint.text, feedback: hint.feedback, at: now }],
  };
}

export function applySolution(ex: Exercise, solution: Solution, now: number): Exercise {
  assertGate(canRequest(ex, 'solution'));
  return { ...touch(ex, now), stage: 'solution', solution };
}

export function applyCheckQuestion(ex: Exercise, q: { question: string; concept: string }, now: number): Exercise {
  assertGate(canRequest(ex, 'check'));
  return { ...touch(ex, now), stage: 'check', check: { question: q.question, concept: q.concept, rounds: [], passed: false } };
}

export function applyCheckAnswer(
  ex: Exercise, answer: string, ev: { verdict: Verdict; feedback: string }, now: number,
): Exercise {
  if (ex.status === 'completed') throw new FlowError('COMPLETED', 'Este ejercicio ya está terminado.');
  if (ex.stage !== 'check' || !ex.check) throw new FlowError('WRONG_STAGE', 'No hay una comprobación activa.');
  if (!isMeaningfulText(answer)) throw new FlowError('EMPTY_ATTEMPT', 'Escribe tu respuesta para poder valorarla.');
  const passed = ev.verdict === 'correct';
  const check = {
    ...ex.check, passed,
    rounds: [...ex.check.rounds, { answer: answer.trim(), verdict: ev.verdict, feedback: ev.feedback, at: now }],
  };
  return passed
    ? { ...touch(ex, now), check, stage: 'done', status: 'completed', completedAt: now }
    : { ...touch(ex, now), check };
}

/** Termina sin superar la comprobación (queda registrado como no superada, no como superada). */
export function finishWithoutPassing(ex: Exercise, now: number): Exercise {
  if (ex.stage !== 'check') throw new FlowError('WRONG_STAGE', 'Solo puedes terminar desde la comprobación.');
  return { ...touch(ex, now), stage: 'done', status: 'completed', completedAt: now };
}

export function restartExercise(ex: Exercise, now: number): Exercise {
  return {
    ...ex, stage: 'attempt', status: 'active', updatedAt: now, completedAt: null, draft: '',
    restarts: ex.restarts + 1, attempts: [], hints: [], solution: null, check: null, pendingClarification: null,
  };
}

export function saveDraft(ex: Exercise, draft: string): Exercise {
  return { ...ex, draft };
}

/** Pista visible por nivel (la variante más reciente). */
export function latestHints(ex: Exercise) {
  const byLevel = new Map<number, Exercise['hints'][number]>();
  for (const h of ex.hints) byLevel.set(h.level, h);
  return [...byLevel.values()].sort((a, b) => a.level - b.level);
}
