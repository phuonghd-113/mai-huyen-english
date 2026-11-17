// Pure progress-state helpers shared by the browser and the Netlify function.
// No runtime imports, so it runs in the browser, in the function bundle and under plain Node.
import type { ExamAttempt, QuestionProgress } from '../types/exam';
import type { Accent, ProgressState, ScopeScore, Settings, WordProgress } from '../types/vocab';

export const DEFAULT_SETTINGS: Settings = { accent: 'en-GB', rate: 0.9, autoSpeak: true };

export function emptyState(): ProgressState {
  return { version: 2, words: {}, scores: {}, questions: {}, attempts: {}, settings: { ...DEFAULT_SETTINGS } };
}

const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
const ID_RE = /^[a-z0-9-]{1,80}$/;
const MAX_TIME = 4102444800000; // year 2100
/** keeps the synced state well under the server's request limit */
export const MAX_ATTEMPTS = 60;
const MAX_ANSWERS = 300;
const MAX_ANSWER_LEN = 6000; // a writing answer of ~150 words fits many times over

function cleanWord(raw: unknown): WordProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const w: WordProgress = {};
  if (r.status === 'learning' || r.status === 'mastered') w.status = r.status;
  if (r.starred === true) w.starred = true;
  const wrong = num(r.wrong, 0, 1e6);
  const right = num(r.right, 0, 1e6);
  const t = num(r.t, 0, MAX_TIME);
  if (wrong) w.wrong = Math.floor(wrong);
  if (right) w.right = Math.floor(right);
  if (t !== undefined) w.t = t;
  return w;
}

function cleanScore(raw: unknown): ScopeScore | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const s: ScopeScore = {};
  const q = num(r.bestQuiz, 0, 100);
  const sp = num(r.bestSpell, 0, 100);
  const m = num(r.bestMatchMs, 0, 3_600_000);
  if (q !== undefined) s.bestQuiz = q;
  if (sp !== undefined) s.bestSpell = sp;
  if (m !== undefined) s.bestMatchMs = m;
  if (typeof r.lastStudied === 'string' && !Number.isNaN(Date.parse(r.lastStudied))) s.lastStudied = r.lastStudied;
  return s;
}

function cleanQuestion(raw: unknown): QuestionProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const q: QuestionProgress = {};
  const wrong = num(r.wrong, 0, 1e6);
  const right = num(r.right, 0, 1e6);
  const t = num(r.t, 0, MAX_TIME);
  if (wrong) q.wrong = Math.floor(wrong);
  if (right) q.right = Math.floor(right);
  if (r.missed === true) q.missed = true;
  if (r.srs && typeof r.srs === 'object') {
    const sr = r.srs as Record<string, unknown>;
    const due = num(sr.due, 0, MAX_TIME);
    const step = num(sr.step, 0, 20);
    if (due !== undefined && step !== undefined) q.srs = { due, step: Math.floor(step) };
  }
  if (t !== undefined) q.t = t;
  return q;
}

function cleanAttempt(id: string, raw: unknown): ExamAttempt | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const examId = typeof r.examId === 'string' && ID_RE.test(r.examId) ? r.examId : null;
  const startedAt = num(r.startedAt, 0, MAX_TIME);
  const t = num(r.t, 0, MAX_TIME);
  if (!examId || startedAt === undefined || t === undefined) return null;
  const a: ExamAttempt = { id, examId, startedAt, answers: {}, t };
  if (r.answers && typeof r.answers === 'object') {
    for (const [qid, v] of Object.entries(r.answers as Record<string, unknown>).slice(0, MAX_ANSWERS)) {
      if (ID_RE.test(qid) && typeof v === 'string' && v.length <= MAX_ANSWER_LEN) a.answers[qid] = v;
    }
  }
  if (Array.isArray(r.flagged)) {
    const f = r.flagged.filter((x): x is string => typeof x === 'string' && ID_RE.test(x)).slice(0, MAX_ANSWERS);
    if (f.length) a.flagged = [...new Set(f)];
  }
  if (r.selfScores && typeof r.selfScores === 'object') {
    const ss: Record<string, number> = {};
    for (const [sid, v] of Object.entries(r.selfScores as Record<string, unknown>).slice(0, 50)) {
      const n = num(v, 0, 1000);
      if (ID_RE.test(sid) && n !== undefined) ss[sid] = n;
    }
    if (Object.keys(ss).length) a.selfScores = ss;
  }
  const submittedAt = num(r.submittedAt, 0, MAX_TIME);
  const score = num(r.score, 0, 1000);
  const remainingMs = num(r.remainingMs, 0, 24 * 3_600_000);
  if (submittedAt !== undefined) a.submittedAt = submittedAt;
  if (score !== undefined) a.score = score;
  if (remainingMs !== undefined) a.remainingMs = remainingMs;
  return a;
}

/** The newest attempts only, so the state cannot grow without bound. Deterministic, so every device keeps the same ones. */
function capAttempts(all: Record<string, ExamAttempt>): Record<string, ExamAttempt> {
  const list = Object.values(all);
  if (list.length <= MAX_ATTEMPTS) return all;
  list.sort((x, y) => y.startedAt - x.startedAt || (x.id < y.id ? -1 : 1));
  return Object.fromEntries(list.slice(0, MAX_ATTEMPTS).map((a) => [a.id, a]));
}

/** Accepts anything (localStorage, an imported file, a request body) and returns a valid state. */
export function sanitizeState(raw: unknown): ProgressState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  if (r.words && typeof r.words === 'object') {
    for (const [id, v] of Object.entries(r.words as Record<string, unknown>)) {
      const w = ID_RE.test(id) ? cleanWord(v) : null;
      if (w) base.words[id] = w;
    }
  }
  if (r.scores && typeof r.scores === 'object') {
    for (const [scope, v] of Object.entries(r.scores as Record<string, unknown>)) {
      const s = ID_RE.test(scope) ? cleanScore(v) : null;
      if (s) base.scores[scope] = s;
    }
  }
  if (r.questions && typeof r.questions === 'object') {
    for (const [id, v] of Object.entries(r.questions as Record<string, unknown>)) {
      const q = ID_RE.test(id) ? cleanQuestion(v) : null;
      if (q) base.questions[id] = q;
    }
  }
  if (r.attempts && typeof r.attempts === 'object') {
    for (const [id, v] of Object.entries(r.attempts as Record<string, unknown>)) {
      const a = ID_RE.test(id) ? cleanAttempt(id, v) : null;
      if (a) base.attempts[id] = a;
    }
    base.attempts = capAttempts(base.attempts);
  }
  if (r.settings && typeof r.settings === 'object') {
    const s = r.settings as Record<string, unknown>;
    if (s.accent === 'en-GB' || s.accent === 'en-US') base.settings.accent = s.accent as Accent;
    const rate = num(s.rate, 0.5, 1.5);
    if (rate !== undefined) base.settings.rate = rate;
    if (typeof s.autoSpeak === 'boolean') base.settings.autoSpeak = s.autoSpeak;
  }
  if (typeof r.lastUnitId === 'string' && ID_RE.test(r.lastUnitId)) base.lastUnitId = r.lastUnitId;
  for (const k of ['resetAt', 'settingsAt', 'lastUnitAt'] as const) {
    const v = num(r[k], 0, MAX_TIME);
    if (v !== undefined) base[k] = v;
  }
  return base;
}

/**
 * Merge two devices' progress without losing work:
 * - each word, exam question and exam attempt: the entry changed last wins
 *   (an emptied entry is kept as a tombstone so it can win too);
 * - each score: the best of both;
 * - "Xóa tiến độ" (resetAt): the latest reset drops everything older on both sides;
 * - settings and the last unit: the side changed last.
 */
export function mergeStates(a: ProgressState, b: ProgressState): ProgressState {
  const resetAt = Math.max(a.resetAt ?? 0, b.resetAt ?? 0);
  const out = emptyState();
  if (resetAt) out.resetAt = resetAt;

  const newest = <T extends { t?: number }>(x: Record<string, T>, y: Record<string, T>, into: Record<string, T>) => {
    for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) {
      const p = x[id];
      const q = y[id];
      const win = !p ? q : !q ? p : (q.t ?? 0) > (p.t ?? 0) ? q : p;
      if (win && (!resetAt || (win.t ?? 0) > resetAt)) into[id] = { ...win };
    }
  };
  // entries saved before syncing existed have no `t`; they are kept unless a reset happened since
  newest(a.words, b.words, out.words);
  newest(a.questions, b.questions, out.questions);
  newest(a.attempts, b.attempts, out.attempts);
  out.attempts = capAttempts(out.attempts);

  const scopes = new Set([...Object.keys(a.scores), ...Object.keys(b.scores)]);
  const resetIso = resetAt ? new Date(resetAt).toISOString() : '';
  for (const scope of scopes) {
    const live = [a.scores[scope], b.scores[scope]].filter((s): s is ScopeScore => !!s && (!resetIso || (s.lastStudied ?? '') > resetIso));
    if (!live.length) continue;
    const s: ScopeScore = {};
    const max = (k: 'bestQuiz' | 'bestSpell') => {
      const v = live.map((x) => x[k]).filter((n): n is number => n !== undefined);
      if (v.length) s[k] = Math.max(...v);
    };
    max('bestQuiz');
    max('bestSpell');
    const ms = live.map((x) => x.bestMatchMs).filter((n): n is number => n !== undefined);
    if (ms.length) s.bestMatchMs = Math.min(...ms);
    const ls = live.map((x) => x.lastStudied).filter((n): n is string => !!n).sort();
    if (ls.length) s.lastStudied = ls[ls.length - 1];
    out.scores[scope] = s;
  }

  const newer = (k: 'settingsAt' | 'lastUnitAt') => ((b[k] ?? 0) > (a[k] ?? 0) ? b : a);
  const st = newer('settingsAt');
  out.settings = { ...st.settings };
  if (st.settingsAt) out.settingsAt = st.settingsAt;
  const lu = newer('lastUnitAt');
  if (lu.lastUnitId) out.lastUnitId = lu.lastUnitId;
  if (lu.lastUnitAt) out.lastUnitAt = lu.lastUnitAt;
  return out;
}

/** Stable JSON for "did anything change?" checks. */
export function stateKey(s: ProgressState): string {
  const sortObj = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([x], [y]) => (x < y ? -1 : 1)));
  return JSON.stringify({
    ...s,
    words: sortObj(s.words),
    scores: sortObj(s.scores),
    questions: sortObj(s.questions),
    attempts: sortObj(s.attempts),
  });
}
