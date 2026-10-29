// Orquesta: 1) pregunta a la máquina de estados si la ayuda está permitida, 2) llama a la IA,
// 3) valida la salida, 4) aplica la transición. Un error de IA nunca hace avanzar de etapa.
import { applyCheckAnswer, applyCheckQuestion, applyHint, applySolution, canRequest, FlowError, setClarification } from '../core/flow';
import type { Exercise, Settings } from '../core/types';
import { buildPrompt, type BuiltPrompt } from './prompts';
import { AIError, type AIProvider } from './provider';
import { parseCheckQuestion, parseEvaluation, parseHint, parseSolution } from './validate';

export type HintRequest = 'hint1' | 'hint2' | 'hint3' | 'rephrase';

async function callParsed<T>(provider: AIProvider, p: BuiltPrompt, parse: (raw: string) => T): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    const system = i === 0 ? p.system : `${p.system}\n\nTu respuesta anterior no era JSON válido. Responde SOLO con el objeto JSON.`;
    try { return parse(await provider.complete({ ...p, system })); }
    catch (e) { lastErr = e; if (!(e instanceof AIError) || e.kind !== 'format') throw e; }
  }
  throw lastErr;
}


export async function requestHint(ex: Exercise, req: HintRequest, provider: AIProvider, settings: Settings, now = Date.now()): Promise<Exercise> {
  const gate = canRequest(ex, req);
  if (!gate.ok) throw new FlowError(gate.code, gate.reason);
  const stage = req === 'rephrase' ? (`hint${ex.stage.slice(4)}` as 'hint1' | 'hint2' | 'hint3') : req;
  const result = await callParsed(provider, buildPrompt(stage, ex, settings, { rephrase: req === 'rephrase' }), parseHint);
  if (result.kind === 'clarify') {
    if (req !== 'hint1') throw new AIError('format', 'La IA pidió una aclaración fuera de la primera pista.');
    return setClarification(ex, result.question, now);
  }
  return applyHint(ex, req, { text: result.text, feedback: result.feedback }, now);
}

export async function requestSolution(ex: Exercise, provider: AIProvider, settings: Settings, now = Date.now()): Promise<Exercise> {
  const gate = canRequest(ex, 'solution');
  if (!gate.ok) throw new FlowError(gate.code, gate.reason);
  const sol = await callParsed(provider, buildPrompt('solution', ex, settings), (r) => parseSolution(r, now));
  return applySolution(ex, sol, now);
}

export async function requestCheck(ex: Exercise, provider: AIProvider, settings: Settings, now = Date.now()): Promise<Exercise> {
  const gate = canRequest(ex, 'check');
  if (!gate.ok) throw new FlowError(gate.code, gate.reason);
  const q = await callParsed(provider, buildPrompt('check', ex, settings), parseCheckQuestion);
  return applyCheckQuestion(ex, q, now);
}

export async function evaluateCheck(ex: Exercise, answer: string, provider: AIProvider, settings: Settings, now = Date.now()): Promise<{ exercise: Exercise; nextHint: string | null }> {
  if (ex.stage !== 'check' || !ex.check) throw new FlowError('WRONG_STAGE', 'No hay una comprobación activa.');
  const ev = await callParsed(provider, buildPrompt('evaluate', ex, settings, { answer }), parseEvaluation);
  const nextHint = ev.verdict === 'correct' ? null : ev.nextHint;
  const feedback = nextHint ? `${ev.feedback}\n\nPista: ${nextHint}` : ev.feedback;
  return { exercise: applyCheckAnswer(ex, answer, { verdict: ev.verdict, feedback }, now), nextHint };
}
