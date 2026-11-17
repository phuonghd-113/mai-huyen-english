import { useEffect, useState } from 'react';
import { QUESTION_TYPES, type QuestionType } from '../types/exam';
import type { StudyMode } from '../types/vocab';

export const MODES: StudyMode[] = ['list', 'flashcards', 'quiz', 'match', 'spell'];

export type Route =
  | { name: 'home' }
  | { name: 'units' }
  | { name: 'unit'; unitId: string; mode: StudyMode }
  | { name: 'review'; mode: StudyMode }
  | { name: 'settings' }
  | { name: 'exams' }
  | { name: 'exam'; examId: string }
  | { name: 'exam-review'; examId: string; attemptId: string }
  | { name: 'practice'; type?: QuestionType }
  | { name: 'mistakes' }
  | { name: 'stats' }
  /** import preview, only with `npm run dev` */
  | { name: 'admin-exam'; examId: string }
  | { name: 'notfound' };

function asMode(s: string | undefined): StudyMode {
  return (MODES as string[]).includes(s ?? '') ? (s as StudyMode) : 'list';
}

function asType(s: string | undefined): QuestionType | undefined {
  return (QUESTION_TYPES as string[]).includes(s ?? '') ? (s as QuestionType) : undefined;
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  const [a, b, c, d] = parts;
  if (!a) return { name: 'home' };
  if (a === 'units') return { name: 'units' };
  if (a === 'settings') return { name: 'settings' };
  if (a === 'review') return { name: 'review', mode: asMode(b) };
  if (a === 'unit' && b) return { name: 'unit', unitId: b, mode: asMode(c) };
  if (a === 'exams' && !b) return { name: 'exams' };
  if (a === 'exam' && b && c === 'review' && d) return { name: 'exam-review', examId: b, attemptId: d };
  if (a === 'exam' && b && !c) return { name: 'exam', examId: b };
  if (a === 'practice') return b && !asType(b) ? { name: 'notfound' } : { name: 'practice', type: asType(b) };
  if (a === 'mistakes') return { name: 'mistakes' };
  if (a === 'stats') return { name: 'stats' };
  if (a === 'admin' && b === 'exam' && c && import.meta.env.DEV) return { name: 'admin-exam', examId: c };
  return { name: 'notfound' };
}

export const href = {
  home: () => '#/',
  units: () => '#/units',
  settings: () => '#/settings',
  unit: (unitId: string, mode: StudyMode = 'list') => `#/unit/${unitId}${mode === 'list' ? '' : `/${mode}`}`,
  review: (mode: StudyMode = 'list') => `#/review${mode === 'list' ? '' : `/${mode}`}`,
  exams: () => '#/exams',
  exam: (examId: string) => `#/exam/${examId}`,
  examReview: (examId: string, attemptId: string) => `#/exam/${examId}/review/${attemptId}`,
  practice: (type?: QuestionType) => `#/practice${type ? `/${type}` : ''}`,
  mistakes: () => '#/mistakes',
  stats: () => '#/stats',
  adminExam: (examId: string) => `#/admin/exam/${examId}`,
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
