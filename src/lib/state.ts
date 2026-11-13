// Pure progress-state helpers shared by the browser and the Netlify function.
// No runtime imports, so it runs in the browser, in the function bundle and under plain Node.
import type { Accent, ProgressState, ScopeScore, Settings, WordProgress } from '../types/vocab';

export const DEFAULT_SETTINGS: Settings = { accent: 'en-GB', rate: 0.9, autoSpeak: true };

export function emptyState(): ProgressState {
  return { version: 1, words: {}, scores: {}, settings: { ...DEFAULT_SETTINGS } };
}

const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
const ID_RE = /^[a-z0-9-]{1,80}$/;
const MAX_TIME = 4102444800000; // year 2100

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
 * - each word: the entry changed last wins (an emptied entry is kept as a tombstone so it can win too);
 * - each score: the best of both;
 * - "Xóa tiến độ" (resetAt): the latest reset drops everything older on both sides;
 * - settings and the last unit: the side changed last.
 */
export function mergeStates(a: ProgressState, b: ProgressState): ProgressState {
  const resetAt = Math.max(a.resetAt ?? 0, b.resetAt ?? 0);
  const out = emptyState();
  if (resetAt) out.resetAt = resetAt;

  const ids = new Set([...Object.keys(a.words), ...Object.keys(b.words)]);
  for (const id of ids) {
    const x = a.words[id];
    const y = b.words[id];
    const win = !x ? y : !y ? x : (y.t ?? 0) > (x.t ?? 0) ? y : x;
    // entries saved before syncing existed have no `t`; keep them unless a reset happened since
    if (win && (!resetAt || (win.t ?? 0) > resetAt)) out.words[id] = { ...win };
  }

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
  return JSON.stringify({ ...s, words: sortObj(s.words), scores: sortObj(s.scores) });
}
