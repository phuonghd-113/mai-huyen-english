import { useEffect, useState } from 'react';
import type { StudyMode } from '../types/vocab';

export const MODES: StudyMode[] = ['list', 'flashcards', 'quiz', 'match', 'spell'];

export type Route =
  | { name: 'home' }
  | { name: 'units' }
  | { name: 'unit'; unitId: string; mode: StudyMode }
  | { name: 'review'; mode: StudyMode }
  | { name: 'settings' }
  | { name: 'notfound' };

function asMode(s: string | undefined): StudyMode {
  return (MODES as string[]).includes(s ?? '') ? (s as StudyMode) : 'list';
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (!a) return { name: 'home' };
  if (a === 'units') return { name: 'units' };
  if (a === 'settings') return { name: 'settings' };
  if (a === 'review') return { name: 'review', mode: asMode(b) };
  if (a === 'unit' && b) return { name: 'unit', unitId: b, mode: asMode(c) };
  return { name: 'notfound' };
}

export const href = {
  home: () => '#/',
  units: () => '#/units',
  settings: () => '#/settings',
  unit: (unitId: string, mode: StudyMode = 'list') => `#/unit/${unitId}${mode === 'list' ? '' : `/${mode}`}`,
  review: (mode: StudyMode = 'list') => `#/review${mode === 'list' ? '' : `/${mode}`}`,
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
