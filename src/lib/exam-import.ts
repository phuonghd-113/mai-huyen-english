// Turn an exam paper's text (from Word via mammoth, or a .txt file) into an Exam draft plus warnings.
// Heuristic by nature: every guess that could be wrong is reported, and `npm run check:data` + the preview
// page (#/admin/exam/<id>) are the safety net. `.ts` imports so `node scripts/import-exam.ts` can load it.
import type { Exam, ExamLevel, Question, QuestionType, Section } from '../types/exam.ts';
import { CHOICE_TYPES, LETTERS } from './grade.ts';

export interface ImportOptions {
  id: string;
  source: string;
  title?: string;
  minutes?: number;
  maxScore?: number;
  year?: number;
  level?: ExamLevel;
  /** answer key from a separate file (otherwise taken from after an "ĐÁP ÁN" line) */
  keyLines?: string[];
}

export interface ImportResult {
  exam: Exam;
  warnings: string[];
}

// ---------------------------------------------------------------- HTML (mammoth) → lines

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/**
 * mammoth's HTML → one string per paragraph, keeping only <u>. Word's automatic numbering is lost by
 * mammoth's text but kept as <ol><li>, so list items get their number back ("1. ") — or a letter
 * ("A. ") for a list nested in a list, the usual shape of options. Table cells are joined with spaces.
 */
export function htmlToLines(html: string): string[] {
  const out: string[] = [];
  let line = '';
  const lists: { ordered: boolean; n: number }[] = [];
  let cells = 0; // inside a table cell: paragraphs join the row instead of breaking it
  const flush = () => {
    out.push(line);
    line = '';
  };
  const re = /<(\/?)([a-zA-Z0-9]+)[^>]*>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) {
      line += m[3].replace(/&(#?\w+);/g, (_, e: string) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCharCode(Number(e.slice(1))) : `&${e};`));
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (tag === 'u') line += closing ? '</u>' : '<u>';
    else if (tag === 'ol' || tag === 'ul') {
      if (closing) lists.pop();
      else {
        if (line.trim()) flush();
        lists.push({ ordered: tag === 'ol', n: 0 });
      }
    } else if (tag === 'li' && !closing) {
      if (line.trim()) flush();
      const l = lists[lists.length - 1];
      if (l) {
        l.n++;
        line += l.ordered ? (lists.length > 1 ? `${LETTERS[l.n - 1] ?? l.n}. ` : `${l.n}. `) : '- ';
      }
    } else if (tag === 'td' || tag === 'th') {
      cells += closing ? -1 : 1;
      if (closing) line += '   ';
    } else if (closing && cells > 0 && /^(p|div|h[1-6])$/.test(tag)) line += ' ';
    else if (closing && /^(p|li|h[1-6]|tr|div)$/.test(tag)) flush();
    else if (tag === 'br') flush();
  }
  flush();
  return cleanLines(out);
}

/** Trim, collapse spaces, tidy <u> (merge "</u><u>", drop empty ones), drop empty lines. */
export function cleanLines(lines: string[]): string[] {
  return lines
    .map((l) =>
      l
        .replace(/ /g, ' ')
        .replace(/<\/u>(\s*)<u>/g, '$1')
        .replace(/<u>(\s*)<\/u>/g, '$1')
        .replace(/[ \t]+/g, ' ')
        .trim(),
    )
    .filter((l) => l && l !== '<u></u>');
}

// ---------------------------------------------------------------- patterns

const KEY_RE = /^(?:ĐÁP\s*ÁN|DAP\s*AN|HƯỚNG\s*DẪN\s*CHẤM|ANSWER\s*KEYS?|KEYS?)\b/i;
const ROMAN = '(?:XV|XIV|XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)';
const SECTION_RES = [
  new RegExp(`^(?:PART|SECTION|PHẦN)\\s+(${ROMAN}|\\d{1,2}|[A-H])\\b\\s*[.:)\\-–]?\\s*(.*)$`, 'i'),
  new RegExp(`^(?:QUESTION|CÂU|BÀI)\\s+(${ROMAN})\\b\\s*[.:)\\-–]?\\s*(.*)$`, 'i'),
  new RegExp(`^(${ROMAN})\\s*[.:)\\-–]\\s*(.*)$`),
];
const QUESTION_RE = /^(?:Question|Câu)?\s*(\d{1,3})\s*[.):]\s*(.*)$/i;
const LEAD_RE = /^(?:→|=>|->|⇒|—>|➝|➔)\s*(.*)$/;
const POINTS_RE = /\(\s*(\d+(?:[.,]\d+)?)\s*(?:points?|pts?|marks?|điểm|đ)\s*\)/i;
const BLANK_RE = /\((\d{1,3})\)\s*(?:_{2,}|\.{3,}|…+)?/g;

/** Instruction keywords → type. Order matters: the first match wins. */
const TYPE_RULES: [QuestionType, RegExp][] = [
  ['pronunciation', /pronounced differently|pronunciation|underlined part.*(sound|pronounc)|phát âm/i],
  ['stress', /\bstress|trọng âm/i],
  ['error-id', /\b(mistakes?|errors?|incorrect|needs? correct|need(s)? to be corrected)\b|lỗi sai/i],
  ['word-form', /(form of the words?|word formation|words? (given )?in (capital|bracket|parenthes)|dạng đúng của từ)/i],
  ['verb-form', /(tense|form) of the verbs?|verbs? in (bracket|parenthes)|chia động từ/i],
  ['preposition', /prepositions?|particles?|giới từ/i],
  ['transform', /rewrite|same meaning|means? (exactly )?the same|without changing|finish (each|the)\b[^.]*\bsentences?|begin(ning|s)? with|viết lại câu/i],
  ['writing', /write (a|an|about) |(paragraph|letter|essay|passage) (of|about|in) (about )?\d+|viết (một )?đoạn văn/i],
  ['cloze-open', /(one|suitable|appropriate) word|ONE word|fill .*(blank|gap).*(word)(?!.*\bA, B)/i],
  ['cloze-mcq', /read .*(choose|best (answer|option)).*(blank|gap|fill)|fill .*(blank|gap).*(A, B|best option|choosing)/i],
  ['reading', /read .*(answer|true|false|questions|decide)|true or false|đọc .*trả lời/i],
  ['mcq', /choose the (best|correct|most suitable) (answer|option|word|one)|A, B, C,? (or|and) D|circle the (best|correct)/i],
];

export function detectType(instruction: string): QuestionType | undefined {
  return TYPE_RULES.find(([, re]) => re.test(instruction))?.[0];
}

/** "A. go B. went C. gone D. going" → options, when the letters run A, B, C… in order. */
export function splitOptions(text: string): { before: string; options: string[] } | null {
  const marks: { letter: string; at: number; end: number }[] = [];
  const re = /(^|\s)([A-H])\s*[.)]\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const want = LETTERS[marks.length];
    if (m[2] !== want) {
      if (m[2] === 'A' && marks.length) break;
      continue;
    }
    marks.push({ letter: m[2], at: m.index + m[1].length, end: m.index + m[0].length });
  }
  if (marks.length < 2) return null;
  const options = marks.map((k, i) => text.slice(k.end, i + 1 < marks.length ? marks[i + 1].at : undefined).trim());
  return { before: text.slice(0, marks[0].at).trim(), options };
}

const stripTrailingBlank = (s: string) => s.replace(/[\s._…]+$/u, '').trim();

// ---------------------------------------------------------------- paper text → sections

interface RawQuestion {
  n: number;
  prompt: string;
  options?: string[];
  lead?: string;
}

interface RawSection {
  header: string;
  instruction: string;
  passage: string[];
  questions: RawQuestion[];
  points?: number;
}

function sectionHeader(line: string): string | null {
  for (const re of SECTION_RES) {
    const m = line.match(re);
    if (m) return (m[2] ?? '').trim();
  }
  return null;
}

function splitPaper(lines: string[]): { head: string[]; sections: RawSection[] } {
  const head: string[] = [];
  const sections: RawSection[] = [];
  let cur: RawSection | null = null;
  let q: RawQuestion | null = null;
  for (const line of lines) {
    const header = sectionHeader(line);
    if (header !== null) {
      cur = { header: line, instruction: header, passage: [], questions: [] };
      sections.push(cur);
      q = null;
      continue;
    }
    if (!cur) {
      head.push(line);
      continue;
    }
    const qm = line.match(QUESTION_RE);
    if (qm) {
      q = { n: Number(qm[1]), prompt: qm[2] };
      cur.questions.push(q);
      continue;
    }
    const lead = line.match(LEAD_RE);
    if (lead && q) {
      q.lead = stripTrailingBlank(lead[1]);
      continue;
    }
    if (q) {
      // options on their own line(s), or the question running on
      q.prompt = q.prompt ? `${q.prompt}\n${line}` : line;
    } else if (!cur.instruction) cur.instruction = line;
    else cur.passage.push(line);
  }
  return { head, sections };
}

// ---------------------------------------------------------------- answer key

type KeyEntry = { answer: string; fix?: string };

function parseKeyEntries(lines: string[]): { sections: Map<number, KeyEntry>[]; global: Map<number, KeyEntry> } {
  const sections: Map<number, KeyEntry>[] = [];
  const global = new Map<number, KeyEntry>();
  let cur: Map<number, KeyEntry> | null = null;
  for (const raw of lines) {
    let line = raw;
    const header = sectionHeader(line);
    if (header !== null) {
      cur = new Map();
      sections.push(cur);
      line = header;
    }
    // "1. B 2. C 3. A", "1-B, 2-C", "1. interesting", "1B 2C"
    const re = /(\d{1,3})\s*[.):\-–]\s*(.+?)(?=[,;]?\s+\d{1,3}\s*[.):\-–]\s|[,;]?\s*$)/g;
    let found = false;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      found = true;
      add(Number(m[1]), m[2]);
    }
    if (!found) {
      const compact = /\b(\d{1,3})\s*([A-D])\b/g;
      while ((m = compact.exec(line))) add(Number(m[1]), m[2]);
    }
  }
  return { sections, global };

  function add(n: number, text: string) {
    const t = text.replace(/[,;]\s*$/, '').trim();
    // error-id: "A (doesn't)", "A → doesn't", "A - doesn't"
    const fixM = t.match(/^([A-D])\s*(?:\((.+)\)|(?:→|->|=>|-|–|:)\s*(.+))$/);
    const e: KeyEntry = fixM ? { answer: fixM[1], fix: (fixM[2] ?? fixM[3]).trim() } : { answer: t };
    cur?.set(n, e);
    if (!global.has(n)) global.set(n, e);
  }
}

/** Full-sentence alternatives "She said … / She told …" become separate answers; "get/ receive" stays one. */
function splitAlternatives(answer: string): string[] {
  const parts = answer.split(/\s+(?:\/|OR|or)\s+/);
  if (parts.length > 1 && parts.every((p) => p.trim().split(/\s+/).length >= 3)) return parts.map((p) => p.trim());
  return [answer.trim()];
}

// ---------------------------------------------------------------- assembly

export function parsePaper(allLines: string[], opts: ImportOptions): ImportResult {
  const warnings: string[] = [];
  const keyAt = allLines.findIndex((l) => KEY_RE.test(l));
  const paper = keyAt >= 0 ? allLines.slice(0, keyAt) : allLines;
  const keyLines = opts.keyLines ?? (keyAt >= 0 ? allLines.slice(keyAt + 1) : []);
  if (!keyLines.length) warnings.push('Không thấy đáp án (dòng "ĐÁP ÁN" hoặc file --key): các câu sẽ chưa tính điểm.');

  const { head, sections: rawAll } = splitPaper(paper);
  const headText = head.join('\n');
  const raw = rawAll.filter((s) => {
    const empty = !s.questions.length && !s.passage.length && !detectType(s.instruction);
    if (empty) warnings.push(`Bỏ dòng tiêu đề nhóm "${s.header}" (không có câu hỏi).`);
    return !empty;
  });
  if (!raw.length) warnings.push('Không nhận ra phần nào (I., II., PART 1…). Kiểm tra lại định dạng file.');

  const id = opts.id;
  const sections: Section[] = raw.map((s, i) => {
    const sid = `s${i + 1}`;
    const where = `Phần ${i + 1} ("${s.header.slice(0, 40)}")`;
    let instruction = s.instruction;
    let points: number | undefined;
    const pm = instruction.match(POINTS_RE) ?? s.passage.join(' ').match(POINTS_RE);
    if (pm) {
      points = Number(pm[1].replace(',', '.'));
      instruction = instruction.replace(POINTS_RE, '').trim();
    }
    let type = detectType(instruction);
    const anyOptions = s.questions.some((q) => splitOptions(q.prompt));
    if (!type) {
      type = s.passage.length ? (anyOptions ? 'cloze-mcq' : 'cloze-open') : anyOptions ? 'mcq' : 'other';
      warnings.push(`${where}: không đoán được dạng bài từ yêu cầu, tạm để "${type}".`);
    }
    // a "reading" section whose blanks sit in the passage is a cloze
    if (type === 'reading' && s.passage.join(' ').match(BLANK_RE) && !s.questions.some((q) => q.prompt.replace(/^\(?\d+\)?/, '').trim().length > 20)) {
      type = anyOptions ? 'cloze-mcq' : 'cloze-open';
    }

    let qs: RawQuestion[] = s.questions;
    const passage = s.passage.join('\n');
    if (!qs.length && passage && (type === 'cloze-open' || type === 'cloze-mcq')) {
      qs = [...passage.matchAll(BLANK_RE)].map((m) => ({ n: Number(m[1]), prompt: `(${m[1]})` }));
      if (!qs.length) warnings.push(`${where}: đoạn văn không có chỗ trống dạng "(1) ____".`);
    }
    if (type === 'writing') {
      const prompt = [...s.passage, ...s.questions.map((q) => q.prompt)].join('\n').trim() || instruction;
      qs = [{ n: 1, prompt }];
    }

    const questions: Question[] = qs.map((q, qi) => {
      const out: Question = { id: `${id}-${sid}-${qi + 1}`, prompt: q.prompt, answers: [] };
      const split = splitOptions(q.prompt);
      if (split && (CHOICE_TYPES.has(type!) || type === 'reading' || type === 'other')) {
        out.prompt = split.before;
        out.options = split.options;
      }
      if ((type === 'cloze-mcq' || type === 'cloze-open') && !out.prompt) out.prompt = `(${q.n})`;
      if (type === 'reading' && !out.options && /true or false|T\s*\/\s*F|đúng hay sai/i.test(instruction)) out.options = ['True', 'False'];
      if (type === 'error-id' && !out.options) {
        const parts = [...out.prompt.matchAll(/<u>([\s\S]*?)<\/u>/g)].map((m) => m[1].trim());
        if (parts.length >= 2) out.options = parts;
        else warnings.push(`${where}, câu ${q.n}: tìm lỗi sai nhưng không thấy 4 phần gạch chân.`);
      }
      if (q.lead) out.lead = q.lead;
      if (type === 'pronunciation' && out.options?.some((o) => !o.includes('<u>'))) {
        warnings.push(`${where}, câu ${q.n}: mất gạch chân ở lựa chọn (thường gặp với PDF) — cần thêm <u>…</u> bằng tay.`);
      }
      return out;
    });
    if (!questions.length) warnings.push(`${where}: không có câu hỏi nào.`);

    return {
      id: sid,
      instruction,
      type: type!,
      points: points ?? NaN,
      ...(passage && type !== 'writing' ? { passage } : {}),
      questions,
    };
  });

  // ---- answer key: per section when the key has as many headed parts, else by question number
  const key = parseKeyEntries(keyLines);
  const keyed = key.sections.filter((m) => m.size);
  const useSections = keyed.length === sections.filter((s) => s.type !== 'writing').length;
  if (keyLines.length && !useSections && keyed.length) warnings.push(`Đáp án có ${keyed.length} phần, đề có ${sections.length} phần: ghép theo số câu.`);
  const numbersRestart = new Set(raw.flatMap((s) => s.questions.map((q) => q.n))).size < raw.reduce((n, s) => n + s.questions.length, 0);
  if (keyLines.length && !useSections && numbersRestart) warnings.push('Số câu bắt đầu lại ở mỗi phần nhưng đáp án không chia phần: có thể ghép sai, hãy soát kỹ.');
  let ks = 0;
  sections.forEach((s, i) => {
    if (s.type === 'writing') return;
    const map = useSections ? keyed[ks++] : key.global;
    const rawQs = raw[i].questions.length ? raw[i].questions : s.questions.map((q) => ({ n: Number(q.prompt.match(/\d+/)?.[0]) }));
    s.questions.forEach((q, qi) => {
      const n = rawQs[qi]?.n ?? qi + 1;
      const e = map?.get(n);
      if (!e) return;
      const choice = !!q.options?.length;
      if (choice) {
        let letter = e.answer.trim().charAt(0).toUpperCase();
        // True/False keys are usually written T / F
        if (q.options![0] === 'True' && q.options![1] === 'False' && /^(T|F)/i.test(e.answer.trim())) letter = /^T/i.test(e.answer.trim()) ? 'A' : 'B';
        if (LETTERS.slice(0, q.options!.length).includes(letter)) q.answers = [letter];
        else warnings.push(`Phần ${i + 1}, câu ${n}: đáp án "${e.answer}" không phải A–${LETTERS[q.options!.length - 1]}.`);
        if (e.fix) q.fix = [e.fix];
      } else q.answers = splitAlternatives(e.answer);
    });
  });

  // ---- points: from the paper, else shared out by question count
  const maxScore = opts.maxScore ?? 20;
  const missing = sections.filter((s) => Number.isNaN(s.points));
  if (missing.length === sections.length && sections.length) {
    const total = sections.reduce((n, s) => n + s.questions.length, 0) || 1;
    let left = maxScore;
    sections.forEach((s, i) => {
      s.points = i === sections.length - 1 ? Math.round(left * 100) / 100 : Math.round(((maxScore * s.questions.length) / total) * 4) / 4;
      left -= s.points;
    });
    warnings.push(`Đề không ghi điểm từng phần: đã chia ${maxScore} điểm theo số câu — sửa lại "points" nếu đề có quy định khác.`);
  } else {
    for (const s of missing) {
      s.points = 0;
      warnings.push(`Phần ${sections.indexOf(s) + 1}: không thấy điểm, tạm để 0.`);
    }
  }

  const title = opts.title ?? head.find((l) => /đề thi|kỳ thi|kì thi|học sinh giỏi|olympic/i.test(l)) ?? head[0] ?? opts.id;
  const minutes = opts.minutes ?? Number(headText.match(/(\d{2,3})\s*phút/i)?.[1] ?? 0);
  if (!minutes) warnings.push('Không thấy thời gian làm bài ("120 phút"): dùng --minutes.');
  const year = opts.year ?? Number(headText.match(/\b(20\d{2})\b/)?.[1] ?? 0);

  const exam: Exam = {
    id,
    title: title.replace(/<\/?u>/g, ''),
    ...(year ? { year } : {}),
    ...(opts.level ? { level: opts.level } : {}),
    minutes: minutes || 120,
    maxScore,
    source: opts.source,
    sections,
  };
  return { exam, warnings };
}
