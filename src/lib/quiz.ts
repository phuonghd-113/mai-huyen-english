import { ALL_WORDS } from '../data';
import type { VocabItem } from '../types/vocab';
import { normalizeAnswer, shuffle } from './text';

export type Direction = 'en-vi' | 'vi-en';

export interface Question {
  word: VocabItem;
  options: VocabItem[];
}

const optionText = (w: VocabItem, dir: Direction) => normalizeAnswer(dir === 'en-vi' ? w.meaning : w.term);

/** 3 distractors: same category from the session pool first, then the whole book, then anything. */
export function buildQuestion(word: VocabItem, pool: VocabItem[], dir: Direction, n = 4): Question {
  const seen = new Set([optionText(word, dir)]);
  const picked: VocabItem[] = [];
  const tiers = [
    pool.filter((w) => w.category === word.category),
    ALL_WORDS.filter((w) => w.category === word.category && w.unitId === word.unitId),
    ALL_WORDS.filter((w) => w.category === word.category),
    ALL_WORDS,
  ];
  for (const tier of tiers) {
    for (const w of shuffle(tier)) {
      if (picked.length >= n - 1) break;
      const t = optionText(w, dir);
      if (w.id === word.id || seen.has(t)) continue;
      seen.add(t);
      picked.push(w);
    }
    if (picked.length >= n - 1) break;
  }
  return { word, options: shuffle([word, ...picked]) };
}

export function buildQuiz(words: VocabItem[], count: number, dir: Direction): Question[] {
  return shuffle(words)
    .slice(0, count)
    .map((w) => buildQuestion(w, words, dir));
}
