// Spaced repetition for exam questions: right → wait longer, wrong → back to tomorrow. No runtime imports.
import type { QuestionProgress } from '../types/exam';

/** Days until the next review after 1, 2, 3… right answers in a row. */
export const SRS_DAYS = [1, 3, 7, 14, 30] as const;
const DAY = 86_400_000;

/** Progress after one answer. A question leaves the mistakes notebook once it is right at the last step. */
export function applyAnswer(prev: QuestionProgress, correct: boolean, now: number): QuestionProgress {
  const next: QuestionProgress = { ...prev, t: now };
  if (correct) {
    next.right = (prev.right ?? 0) + 1;
    if (prev.srs) {
      const step = prev.srs.step + 1;
      if (step >= SRS_DAYS.length) {
        delete next.srs;
        delete next.missed;
      } else {
        next.srs = { step, due: now + SRS_DAYS[step] * DAY };
        delete next.missed;
      }
    }
  } else {
    next.wrong = (prev.wrong ?? 0) + 1;
    next.missed = true;
    next.srs = { step: 0, due: now + SRS_DAYS[0] * DAY };
  }
  return next;
}

/** In the review queue: answered wrong at some point and not yet worked through every step. */
export function isQueued(p: QuestionProgress | undefined): boolean {
  return !!p?.srs;
}

export function isDue(p: QuestionProgress | undefined, now: number): boolean {
  return !!p?.srs && p.srs.due <= now;
}
