import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCheckAnswer, applyCheckQuestion, applyHint, applySolution, canRequest, FlowError, finishWithoutPassing,
  newExercise, restartExercise, submitAttempt,
} from '../src/core/flow';
import type { Exercise, Mode, Solution } from '../src/core/types';

const SOL: Solution = { answer: '42', verified: true, steps: ['a'], connection: 'c', mistakes: [], why: 'w', uncertainty: null, at: 0 };
const H = { text: 'pista', feedback: null };
const mk = (mode: Mode = 'strict') => newExercise({ prompt: 'Calcula 6 x 7', mode, now: 1, id: 'x' });
const code = (fn: () => unknown) => { try { fn(); } catch (e) { return e instanceof FlowError ? e.code : 'OTHER'; } return 'NONE'; };

function toHint3Strict(): Exercise {
  let e = submitAttempt(mk(), 'creo que multiplicando', 2);
  e = applyHint(e, 'hint1', H, 3);
  e = submitAttempt(e, 'sumo siete veces', 4);
  e = applyHint(e, 'hint2', H, 5);
  e = submitAttempt(e, 'seis por siete', 6);
  return applyHint(e, 'hint3', H, 7);
}

test('sin intento no se desbloquea ninguna ayuda', () => {
  const e = mk();
  for (const r of ['hint1', 'hint2', 'hint3', 'solution', 'check', 'rephrase'] as const)
    assert.equal(canRequest(e, r).ok, false, r);
  assert.equal(code(() => applyHint(e, 'hint1', H, 2)), 'LOCKED');
  assert.equal(code(() => applySolution(e, SOL, 2)), 'LOCKED');
});

test('intento vacío, solo símbolos o duplicado se rechazan', () => {
  const e = mk();
  assert.equal(code(() => submitAttempt(e, '   ', 2)), 'EMPTY_ATTEMPT');
  assert.equal(code(() => submitAttempt(e, '???', 2)), 'EMPTY_ATTEMPT');
  assert.equal(submitAttempt(e, 'x=6', 2).attempts.length, 1); // las respuestas breves valen
  const e2 = submitAttempt(e, 'pruebo con 6', 2);
  assert.equal(code(() => submitAttempt(e2, '  Pruebo  con 6 ', 3)), 'DUPLICATE_ATTEMPT');
});

test('estricto: las pistas son secuenciales y exigen reintento entre pistas', () => {
  let e = submitAttempt(mk(), 'mi intento', 2);
  assert.equal(code(() => applyHint(e, 'hint2', H, 3)), 'WRONG_STAGE');
  e = applyHint(e, 'hint1', H, 3);
  assert.equal(e.stage, 'hint1');
  assert.equal(canRequest(e, 'hint2').ok, false); // falta reintento
  assert.equal(code(() => applyHint(e, 'hint3', H, 4)), 'WRONG_STAGE');
  e = submitAttempt(e, 'segundo intento', 4);
  assert.equal(e.attempts[1]?.afterHint, 1);
  assert.equal(canRequest(e, 'hint2').ok, true);
});

test('estricto: la solución solo tras pista 3 y un reintento; nunca antes', () => {
  let e = submitAttempt(mk(), 'a', 2);
  e = applyHint(e, 'hint1', H, 3);
  assert.equal(code(() => applySolution(e, SOL, 4)), 'LOCKED');
  e = submitAttempt(e, 'b', 4); e = applyHint(e, 'hint2', H, 5);
  assert.equal(code(() => applySolution(e, SOL, 6)), 'LOCKED');
  e = submitAttempt(e, 'c', 6); e = applyHint(e, 'hint3', H, 7);
  assert.equal(code(() => applySolution(e, SOL, 8)), 'LOCKED'); // falta reintento tras la 3
  e = submitAttempt(e, 'd', 8);
  assert.equal(applySolution(e, SOL, 9).stage, 'solution');
});

test('estricto no permite reformular; flexible sí', () => {
  const s = applyHint(submitAttempt(mk(), 'a', 2), 'hint1', H, 3);
  assert.equal(canRequest(s, 'rephrase').ok, false);
  const f = applyHint(submitAttempt(mk('flexible'), 'a', 2), 'hint1', H, 3);
  const f2 = applyHint(f, 'rephrase', H, 4);
  assert.equal(f2.stage, 'hint1');
  assert.deepEqual(f2.hints.map((h) => h.variant), [0, 1]);
});

test('flexible: sigue exigiendo intento inicial y permite ver la solución tras pista 2 con otro intento', () => {
  let e = mk('flexible');
  assert.equal(canRequest(e, 'hint1').ok, false);
  e = applyHint(submitAttempt(e, 'a', 2), 'hint1', H, 3);
  e = applyHint(e, 'hint2', H, 4); // sin reintento: permitido en flexible
  assert.equal(canRequest(e, 'solution').ok, false); // solo 1 intento
  e = submitAttempt(e, 'b', 5);
  assert.equal(applySolution(e, SOL, 6).stage, 'solution');
});

test('no se puede saltar etapas aunque se invoque la función directamente', () => {
  const e = toHint3Strict();
  assert.equal(code(() => applyCheckQuestion(e, { question: 'q', concept: 'c' }, 9)), 'WRONG_STAGE');
  assert.equal(code(() => applyCheckAnswer(e, 'respuesta', { verdict: 'correct', feedback: 'ok' }, 9)), 'WRONG_STAGE');
  assert.equal(code(() => finishWithoutPassing(e, 9)), 'WRONG_STAGE');
});

test('flujo completo: solución, comprobación fallida, reintento y éxito', () => {
  let e = submitAttempt(toHint3Strict(), 'último intento', 8);
  e = applySolution(e, SOL, 9);
  e = applyCheckQuestion(e, { question: '¿8 x 7?', concept: 'multiplicar' }, 10);
  assert.equal(e.stage, 'check');
  e = applyCheckAnswer(e, '54', { verdict: 'incorrect', feedback: 'casi' }, 11);
  assert.equal(e.status, 'active');
  assert.equal(e.check?.passed, false);
  e = applyCheckAnswer(e, '56', { verdict: 'correct', feedback: 'bien' }, 12);
  assert.equal(e.status, 'completed');
  assert.equal(e.stage, 'done');
  assert.equal(e.check?.passed, true);
  assert.equal(code(() => submitAttempt(e, 'más', 13)), 'COMPLETED');
});

test('una valoración "partial" no completa el ejercicio y terminar sin superar queda registrado', () => {
  let e = submitAttempt(toHint3Strict(), 'x', 8);
  e = applyCheckQuestion(applySolution(e, SOL, 9), { question: 'q', concept: 'c' }, 10);
  e = applyCheckAnswer(e, 'algo', { verdict: 'partial', feedback: 'f' }, 11);
  assert.equal(e.status, 'active');
  const done = finishWithoutPassing(e, 12);
  assert.equal(done.status, 'completed');
  assert.equal(done.check?.passed, false);
});

test('reiniciar vuelve a bloquear todo y no muta el original', () => {
  const e = toHint3Strict();
  const r = restartExercise(e, 20);
  assert.equal(r.stage, 'attempt');
  assert.equal(r.attempts.length, 0);
  assert.equal(r.restarts, 1);
  assert.equal(canRequest(r, 'hint1').ok, false);
  assert.equal(e.hints.length, 3);
});
