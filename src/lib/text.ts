// Pure text helpers: speech text, typing answers, normalisation. No imports so it can run under plain Node.

/** Text for speech synthesis. */
export function toSpeakText(term: string): string {
  return term
    .replace(/\bsb\b/g, 'somebody')
    .replace(/\bsth\b/g, 'something')
    .replace(/\+\s*(N|V-ing|to V)\b.*$/i, '')
    .replace(/\bto V\b/g, 'to do')
    .replace(/\s*\/\s*/g, ' or ')
    .replace(/[()]/g, ' ')
    .replace(/…|\.\.\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise a typed answer or an expected answer for comparison. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\bsomebody\b|\bsomeone\b/g, 'sb')
    .replace(/\bsomething\b|\bsmth\b/g, 'sth')
    .replace(/\btobe\b/g, 'be')
    .replace(/[.,!?;:"…]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandParens(s: string): string[] {
  // "go back (to)" → ["go back to", "go back"]; "get on(to)" → ["get onto", "get on"]
  const m = s.match(/\(([^()]*)\)/);
  if (!m || m.index === undefined) return [s];
  const before = s.slice(0, m.index);
  const after = s.slice(m.index + m[0].length);
  const withIt = `${before}${m[1]}${after}`;
  const without = `${before}${after}`;
  return [...expandParens(withIt), ...expandParens(without)];
}

function expandSlashes(s: string): string[] {
  // "cheat at/ in" → ["cheat at", "cheat in"] (token-level alternatives)
  const m = s.match(/(\S+)\/\s*(\S+)/);
  if (!m || m.index === undefined) return [s];
  const before = s.slice(0, m.index);
  const after = s.slice(m.index + m[0].length);
  return [...expandSlashes(before + m[1] + after), ...expandSlashes(before + m[2] + after)];
}

/** All accepted spellings for a term (already normalised). The first item is the canonical one. */
export function acceptedAnswers(term: string): string[] {
  const base = term.replace(/\+\s*(N|V-ing|to V).*$/i, '').trim();
  const out = new Set<string>();
  for (const a of expandParens(base)) {
    for (const b of expandSlashes(a)) {
      const n = normalizeAnswer(b);
      if (!n) continue;
      out.add(n);
      // sb / sth are optional placeholders
      const stripped = n.replace(/\b(sb|sth)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (stripped) out.add(stripped);
    }
  }
  return [...out];
}

export function isCorrectAnswer(input: string, term: string): boolean {
  const n = normalizeAnswer(input);
  if (!n) return false;
  const stripped = n.replace(/\b(sb|sth)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const accepted = acceptedAnswers(term);
  return accepted.includes(n) || accepted.includes(stripped);
}

/** The canonical answer to reveal / hint against (first parenthesis + slash option, placeholders kept). */
export function canonicalAnswer(term: string): string {
  return acceptedAnswers(term)[0] ?? term;
}

/** Strip Vietnamese diacritics for accent-insensitive search. */
export function foldVi(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

export function formatMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
