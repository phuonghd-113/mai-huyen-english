import type { UnitData, VocabItem } from '../types/vocab';
import { RAW_UNITS } from './units';
import { toSpeakText } from '../lib/text';

export const UNITS: UnitData[] = RAW_UNITS.map((u) => ({
  ...u,
  words: u.words.map(([id, term, pos, ipa, meaning, category, note], idx): VocabItem => ({
    id,
    stt: idx + 1,
    unitId: u.id,
    unitNumber: u.unitNumber,
    term,
    pos,
    ipa,
    meaning,
    category,
    note,
    speakText: toSpeakText(term),
  })),
}));

export const ALL_WORDS: VocabItem[] = UNITS.flatMap((u) => u.words);

export const WORD_BY_ID = new Map(ALL_WORDS.map((w) => [w.id, w]));

export const UNIT_BY_ID = new Map(UNITS.map((u) => [u.id, u]));

export const CATEGORY_LABEL: Record<VocabItem['category'], string> = {
  word: 'Từ đơn',
  'phrasal-verb': 'Phrasal verb',
  phrase: 'Cụm từ',
};
