// Hooks and small helpers shared by the exam pages.
import { useEffect, useState } from 'react';
import { loadAllExams, loadExam } from '../data/exams';
import type { Exam, ExamAttempt } from '../types/exam';
import type { ProgressState } from '../types/vocab';
import { scoreExam, type ExamResult } from './grade';

export type Loaded<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

function useLoad<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [v, setV] = useState<Loaded<T>>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setV({ status: 'loading' });
    load().then(
      (data) => alive && setV({ status: 'ready', data }),
      () => alive && setV({ status: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return v;
}

export const useExam = (id: string) => useLoad(() => loadExam(id), id);
export const useAllExams = () => useLoad(loadAllExams, 'all');

/** Key under which an error-id correction is stored next to the chosen letter. */
export const fixKey = (questionId: string) => `${questionId}-fix`;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
export const sectionLabel = (i: number) => ROMAN[i] ?? String(i + 1);

/** 65 min → "1:05:00", 9.5 min → "09:30". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ',');
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Attempts of one paper that were not thrown away, newest first. */
export function attemptsOf(state: ProgressState, examId: string): ExamAttempt[] {
  return Object.values(state.attempts)
    .filter((a) => a.examId === examId && !a.abandoned)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function unfinishedAttempt(state: ProgressState, examId: string): ExamAttempt | undefined {
  return attemptsOf(state, examId).find((a) => !a.submittedAt);
}

/** Score recomputed from the paper as it is now, so a key fixed later also fixes old results. */
export function resultOf(exam: Exam, a: ExamAttempt): ExamResult {
  return scoreExam(exam, a.answers, a.selfScores);
}

export function newAttemptId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function countWords(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}
