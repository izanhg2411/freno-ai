import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../src/core/stats';
import { newExercise, submitAttempt } from '../src/core/flow';

const D = 86_400_000;
const at = (day: number) => day * D + 1000;

test('sin datos, todo es cero (no hay cifras inventadas)', () => {
  assert.deepEqual(computeStats([], at(100), 0), {
    completed: 0, checksPassed: 0, inProgress: 0, studyDays: 0, currentStreak: 0, bestStreak: 0,
  });
});

test('racha: días consecutivos, ayer cuenta y un hueco la reinicia', () => {
  let e = newExercise({ prompt: 'ejercicio de prueba', mode: 'strict', now: at(90), id: 'a' });
  e = submitAttempt(e, 'uno', at(90));
  e = submitAttempt(e, 'dos', at(91));
  e = submitAttempt(e, 'tres', at(92));
  e = submitAttempt(e, 'cuatro', at(95));
  assert.equal(computeStats([e], at(95), 0).currentStreak, 1);
  assert.equal(computeStats([e], at(96), 0).currentStreak, 1); // ayer cuenta
  assert.equal(computeStats([e], at(98), 0).currentStreak, 0);
  assert.equal(computeStats([e], at(98), 0).bestStreak, 3);
  assert.equal(computeStats([e], at(98), 0).studyDays, 4);
});
