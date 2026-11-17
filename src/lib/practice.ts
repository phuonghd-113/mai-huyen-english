// Choosing questions for practice by type and for the mistakes notebook. Only type imports (runs under Node).
import type { BankQuestion, QuestionProgress, QuestionType } from '../types/exam';
import { isGradable } from './grade.ts';
import { isDue, isQueued } from './srs.ts';

/** Practice needs an answer to check against: writing and questions without a key are left out. */
export function practicable(q: BankQuestion): boolean {
  return isGradable(q, q.type);
}

/**
 * Lower = asked sooner, in bands that never overlap: never answered [0, 1), last answer wrong [2, 3.5),
 * the rest [4, 5.5). Inside a band, a higher error rate comes first; the random part
 * (< 0.5 outside the first band) only reorders questions that did about as well.
 */
function priority(p: QuestionProgress | undefined, rand: number): number {
  if (!p || (!p.right && !p.wrong)) return rand;
  const wrong = p.wrong ?? 0;
  const errorRate = wrong / (wrong + (p.right ?? 0));
  return (p.missed ? 2 : 4) + (1 - errorRate) + rand * 0.5;
}

export function pickPractice(
  bank: readonly BankQuestion[],
  progress: Record<string, QuestionProgress>,
  type: QuestionType,
  count: number,
  random: () => number = Math.random,
): BankQuestion[] {
  return bank
    .filter((q) => q.type === type && practicable(q))
    .map((q) => ({ q, k: priority(progress[q.id], random()) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, count)
    .map(({ q }) => q);
}

/** In the mistakes notebook: wrong at some point and not yet worked through every review step. */
export function queuedQuestions(bank: readonly BankQuestion[], progress: Record<string, QuestionProgress>): BankQuestion[] {
  return bank
    .filter((q) => practicable(q) && isQueued(progress[q.id]))
    .sort((a, b) => progress[a.id]!.srs!.due - progress[b.id]!.srs!.due);
}

export function dueQuestions(bank: readonly BankQuestion[], progress: Record<string, QuestionProgress>, now: number): BankQuestion[] {
  return queuedQuestions(bank, progress).filter((q) => isDue(progress[q.id], now));
}

export interface TypeStats {
  type: QuestionType;
  total: number;
  /** questions answered at least once */
  seen: number;
  right: number;
  wrong: number;
}

/** Per type: how many questions exist and how well they have gone (practice and submitted papers). */
export function typeStats(bank: readonly BankQuestion[], progress: Record<string, QuestionProgress>): TypeStats[] {
  const by = new Map<QuestionType, TypeStats>();
  for (const q of bank) {
    if (!practicable(q)) continue;
    const s = by.get(q.type) ?? { type: q.type, total: 0, seen: 0, right: 0, wrong: 0 };
    s.total++;
    const p = progress[q.id];
    if (p && (p.right || p.wrong)) s.seen++;
    s.right += p?.right ?? 0;
    s.wrong += p?.wrong ?? 0;
    by.set(q.type, s);
  }
  return [...by.values()];
}
