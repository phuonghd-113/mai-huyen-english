import type { ExamAttempt, QuestionProgress } from './exam';

export type VocabCategory = 'word' | 'phrasal-verb' | 'phrase';

/** [id, term, pos, ipa, meaning, category, note?] — compact form stored in src/data/units.ts */
export type RawWord = [string, string, string, string, string, VocabCategory, string?];

export interface RawUnit {
  id: string;
  unitNumber: number;
  title: string;
  viTitle: string;
  icon: string;
  color: string;
  words: RawWord[];
}

export interface VocabItem {
  id: string;
  stt: number;
  unitId: string;
  unitNumber: number;
  term: string;
  pos: string;
  ipa: string;
  meaning: string;
  category: VocabCategory;
  note?: string;
  /** Text sent to speech synthesis (sb → somebody, a/ b → a or b…) */
  speakText: string;
}

export interface UnitData extends Omit<RawUnit, 'words'> {
  words: VocabItem[];
}

export type StudyMode = 'list' | 'flashcards' | 'quiz' | 'match' | 'spell';

export type WordStatus = 'new' | 'learning' | 'mastered';

export interface WordProgress {
  status?: 'learning' | 'mastered';
  starred?: boolean;
  wrong?: number;
  right?: number;
  /** last change, ms since epoch: used to merge devices (newest wins) */
  t?: number;
}

export interface ScopeScore {
  /** best quiz score, percent */
  bestQuiz?: number;
  bestMatchMs?: number;
  /** best spelling score, percent */
  bestSpell?: number;
  lastStudied?: string;
}

export type Accent = 'en-GB' | 'en-US';

export interface Settings {
  accent: Accent;
  rate: number;
  autoSpeak: boolean;
}

export interface ProgressState {
  /** 1: vocabulary only. 2: adds exam questions and attempts (v1 data loads as v2 with them empty) */
  version: 2;
  words: Record<string, WordProgress>;
  scores: Record<string, ScopeScore>;
  /** exam question id → progress (practice, mistakes notebook, SRS) */
  questions: Record<string, QuestionProgress>;
  /** attempt id → one sitting of an exam paper, finished or not */
  attempts: Record<string, ExamAttempt>;
  settings: Settings;
  lastUnitId?: string;
  /** "Xóa tiến độ" time: anything older is dropped when devices merge */
  resetAt?: number;
  settingsAt?: number;
  lastUnitAt?: number;
}
