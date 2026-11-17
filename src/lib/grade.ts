// Scoring exam questions. Only type imports, so it runs in the browser and under plain Node (check:data).
import type { BankQuestion, Exam, Question, QuestionType, Section } from '../types/exam';

/** Questions answered by picking an option letter. */
export const CHOICE_TYPES: ReadonlySet<QuestionType> = new Set(['pronunciation', 'stress', 'mcq', 'error-id', 'cloze-mcq']);

export const LETTERS = 'ABCDEFGH';

export function questionType(q: Question, section: Section): QuestionType {
  return q.type ?? section.type;
}

/** A choice question either by type, or a reading/other question that comes with options (True/False, A–D). */
export function isChoice(q: Question, type: QuestionType): boolean {
  return CHOICE_TYPES.has(type) || ((type === 'reading' || type === 'other') && !!q.options?.length);
}

/** Can this question be scored automatically? Writing and questions without a key cannot. */
export function isGradable(q: Question, type: QuestionType): boolean {
  return type !== 'writing' && q.answers.length > 0;
}

// Contractions are expanded before comparing, so "doesn't" = "does not". "'s" and "'d" are ambiguous and left alone.
const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/\bain't\b/g, 'is not'],
  [/n't\b/g, ' not'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
  [/\bi'm\b/g, 'i am'],
];

/** Normalise a typed answer or a key for comparison: case, quotes, contractions, punctuation, spaces. */
export function normalizeText(s: string): string {
  let t = s
    .normalize('NFC')
    .toLowerCase()
    .replace(/<\/?u>/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"');
  for (const [re, to] of CONTRACTIONS) t = t.replace(re, to);
  return t
    .replace(/[.,!?;:"…()[\]]/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandParens(s: string): string[] {
  // "(has) gone" → ["has gone", "gone"]
  const m = s.match(/\(([^()]*)\)/);
  if (!m || m.index === undefined) return [s];
  const before = s.slice(0, m.index);
  const after = s.slice(m.index + m[0].length);
  return [...expandParens(`${before}${m[1]}${after}`), ...expandParens(`${before}${after}`)];
}

function expandSlashes(s: string): string[] {
  // "in/ at" → ["in", "at"] (one word against one word)
  const m = s.match(/(\S+)\s*\/\s*(\S+)/);
  if (!m || m.index === undefined) return [s];
  const before = s.slice(0, m.index);
  const after = s.slice(m.index + m[0].length);
  return [...expandSlashes(before + m[1] + after), ...expandSlashes(before + m[2] + after)];
}

/** Every accepted spelling of one key, normalised. Answers stay short, so the expansion stays small. */
export function expandAnswer(key: string): string[] {
  const out = new Set<string>();
  for (const a of expandParens(key)) for (const b of expandSlashes(a)) {
    const n = normalizeText(b);
    if (n) out.add(n);
  }
  return [...out];
}

export function textMatches(input: string, keys: readonly string[]): boolean {
  const n = normalizeText(input);
  if (!n) return false;
  return keys.some((k) => expandAnswer(k).includes(n));
}

/** Option letter from what the student picked: "b", "B.", " B " → "B". */
export function normalizeChoice(input: string): string {
  return input.trim().replace(/[.)]$/, '').toUpperCase();
}

/**
 * Score one answer: true/false, or null when it cannot be scored (writing, no key).
 * Transform questions with a given beginning accept the sentence with or without that beginning.
 */
export function gradeAnswer(q: Question, type: QuestionType, input: string | undefined): boolean | null {
  if (!isGradable(q, type)) return null;
  if (!input?.trim()) return false;
  if (isChoice(q, type)) return q.answers.some((a) => normalizeChoice(a) === normalizeChoice(input));
  if (type === 'transform' && q.lead) {
    const lead = normalizeText(q.lead);
    const n = normalizeText(input);
    const full = n.startsWith(lead) ? input : `${q.lead} ${input}`;
    return textMatches(full, q.answers.map((a) => (normalizeText(a).startsWith(lead) ? a : `${q.lead} ${a}`)));
  }
  return textMatches(input, q.answers);
}

export interface SectionResult {
  sectionId: string;
  score: number;
  /** points this section is worth on the paper */
  max: number;
  /** points that could be scored automatically (questions with a key, not writing) */
  gradedMax: number;
  correct: number;
  gradable: number;
  total: number;
}

export interface ExamResult {
  score: number;
  max: number;
  gradedMax: number;
  sections: SectionResult[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Score a whole attempt. Each question is worth section.points / number of questions.
 * Self-scored sections (writing) take the student's own mark, capped at the section's points.
 */
export function scoreExam(exam: Exam, answers: Record<string, string>, selfScores: Record<string, number> = {}): ExamResult {
  const sections = exam.sections.map((s): SectionResult => {
    const each = s.questions.length ? s.points / s.questions.length : 0;
    let correct = 0;
    let gradable = 0;
    for (const q of s.questions) {
      const r = gradeAnswer(q, questionType(q, s), answers[q.id]);
      if (r === null) continue;
      gradable++;
      if (r) correct++;
    }
    let score = correct * each;
    let gradedMax = gradable * each;
    const self = selfScores[s.id];
    if (self !== undefined && gradable < s.questions.length) {
      // the ungradable part (usually the whole writing section) takes the student's own mark
      const rest = s.points - gradedMax;
      score += Math.min(Math.max(self, 0), rest);
      gradedMax = s.points;
    }
    return { sectionId: s.id, score: round2(score), max: s.points, gradedMax: round2(gradedMax), correct, gradable, total: s.questions.length };
  });
  return {
    score: round2(sections.reduce((n, s) => n + s.score, 0)),
    max: exam.maxScore,
    gradedMax: round2(sections.reduce((n, s) => n + s.gradedMax, 0)),
    sections,
  };
}

/** Flatten papers into the question bank used by practice and the mistakes notebook. */
export function toBank(exams: readonly Exam[]): BankQuestion[] {
  return exams.flatMap((e) =>
    e.sections.flatMap((s) =>
      s.questions.map(
        (q): BankQuestion => ({
          ...q,
          type: questionType(q, s),
          examId: e.id,
          sectionId: s.id,
          instruction: s.instruction,
          passage: s.passage,
        }),
      ),
    ),
  );
}
