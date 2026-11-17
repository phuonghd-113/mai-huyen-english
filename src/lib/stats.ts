// Numbers for the stats page and the home page's "Hôm nay". Only type imports + .ts paths (runs under Node).
import type { BankQuestion, Exam, ExamAttempt, QuestionProgress, QuestionType } from '../types/exam';
import { scoreExam } from './grade.ts';
import { practicable } from './practice.ts';

/** Fewer answers than this and a type's accuracy says nothing yet. */
export const MIN_ANSWERS = 5;

export interface TypeAccuracy {
  type: QuestionType;
  /** questions of this type that can be practised */
  total: number;
  right: number;
  wrong: number;
  /** right / (right + wrong), 0–1; undefined before MIN_ANSWERS answers */
  rate?: number;
}

/** Accuracy per type, weakest first; types without enough answers go last, in bank order. */
export function typeAccuracy(bank: readonly BankQuestion[], progress: Record<string, QuestionProgress>): TypeAccuracy[] {
  const by = new Map<QuestionType, TypeAccuracy>();
  for (const q of bank) {
    if (!practicable(q)) continue;
    const a = by.get(q.type) ?? { type: q.type, total: 0, right: 0, wrong: 0 };
    a.total++;
    a.right += progress[q.id]?.right ?? 0;
    a.wrong += progress[q.id]?.wrong ?? 0;
    by.set(q.type, a);
  }
  const list = [...by.values()].map((a) => {
    const n = a.right + a.wrong;
    return n >= MIN_ANSWERS ? { ...a, rate: a.right / n } : a;
  });
  const rated = list.filter((a) => a.rate !== undefined).sort((x, y) => x.rate! - y.rate! || y.wrong - x.wrong);
  return [...rated, ...list.filter((a) => a.rate === undefined)];
}

/** The weakest types worth practising: enough answers and below 80% right. */
export function weakestTypes(acc: readonly TypeAccuracy[], n = 3): TypeAccuracy[] {
  return acc.filter((a) => a.rate !== undefined && a.rate < 0.8).slice(0, n);
}

export interface ScorePoint {
  attemptId: string;
  examId: string;
  title: string;
  submittedAt: number;
  score: number;
  max: number;
  /** score / max, 0–1 */
  ratio: number;
}

/** Submitted attempts of papers still in the app, oldest first, scored against the paper as it is now. */
export function scoreHistory(exams: readonly Exam[], attempts: Record<string, ExamAttempt>): ScorePoint[] {
  const byId = new Map(exams.map((e) => [e.id, e]));
  return Object.values(attempts)
    .filter((a) => a.submittedAt && !a.abandoned && byId.has(a.examId))
    .sort((a, b) => a.submittedAt! - b.submittedAt!)
    .map((a) => {
      const e = byId.get(a.examId)!;
      const r = scoreExam(e, a.answers, a.selfScores);
      return { attemptId: a.id, examId: e.id, title: e.title, submittedAt: a.submittedAt!, score: r.score, max: r.max, ratio: r.max ? r.score / r.max : 0 };
    });
}

/** One scale for the chart: the papers' own scale when they all share it, otherwise 10 (Vietnamese marks). */
export function chartScale(points: readonly ScorePoint[]): number {
  const maxes = new Set(points.map((p) => p.max));
  return maxes.size === 1 ? [...maxes][0] : 10;
}

export interface Totals {
  examsDone: number;
  /** distinct questions answered at least once */
  questionsSeen: number;
  answers: number;
  right: number;
  inNotebook: number;
  dueNow: number;
}

export function totals(points: readonly ScorePoint[], progress: Record<string, QuestionProgress>, now: number): Totals {
  const t: Totals = { examsDone: points.length, questionsSeen: 0, answers: 0, right: 0, inNotebook: 0, dueNow: 0 };
  for (const p of Object.values(progress)) {
    const n = (p.right ?? 0) + (p.wrong ?? 0);
    if (n) t.questionsSeen++;
    t.answers += n;
    t.right += p.right ?? 0;
    if (p.srs) {
      t.inNotebook++;
      if (p.srs.due <= now) t.dueNow++;
    }
  }
  return t;
}
