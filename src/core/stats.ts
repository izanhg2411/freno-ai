import type { Exercise } from './types';

export interface Stats {
  completed: number; checksPassed: number; inProgress: number;
  studyDays: number; currentStreak: number; bestStreak: number;
}

const DAY = 86_400_000;
const dayOf = (ts: number, tzOffsetMin: number) => Math.floor((ts - tzOffsetMin * 60_000) / DAY);

/** Estadísticas derivadas SOLO de datos reales. La racha no penaliza: si falta un día se reinicia sin mensajes. */
export function computeStats(exercises: Exercise[], now: number, tzOffsetMin = new Date(now).getTimezoneOffset()): Stats {
  const days = new Set<number>();
  for (const ex of exercises) {
    for (const a of ex.attempts) days.add(dayOf(a.at, tzOffsetMin));
    for (const h of ex.hints) days.add(dayOf(h.at, tzOffsetMin));
    for (const r of ex.check?.rounds ?? []) days.add(dayOf(r.at, tzOffsetMin));
  }
  const sorted = [...days].sort((a, b) => a - b);
  let best = 0, run = 0, prev = Number.NaN;
  for (const d of sorted) {
    run = d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const today = dayOf(now, tzOffsetMin);
  let cursor = days.has(today) ? today : today - 1;
  let current = 0;
  while (days.has(cursor)) { current++; cursor--; }
  return {
    completed: exercises.filter((e) => e.status === 'completed').length,
    checksPassed: exercises.filter((e) => e.check?.passed).length,
    inProgress: exercises.filter((e) => e.status === 'active').length,
    studyDays: days.size, currentStreak: current, bestStreak: best,
  };
}
