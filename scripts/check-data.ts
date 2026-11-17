// Run: npm run check:data  (Node ≥ 22.18 runs TypeScript directly)
import { RAW_UNITS } from '../src/data/units.ts';
import { acceptedAnswers, isCorrectAnswer, toSpeakText } from '../src/lib/text.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { checkExam } from '../src/lib/exam-check.ts';
import { gradeAnswer, normalizeText, scoreExam } from '../src/lib/grade.ts';
import type { Exam, Question, QuestionType } from '../src/types/exam.ts';

const errors: string[] = [];
const warnings: string[] = [];
const ids = new Set<string>();
let total = 0;

for (const u of RAW_UNITS) {
  const cats = new Set<string>();
  for (const [id, term, pos, ipa, meaning, category] of u.words) {
    total++;
    const where = `${u.id} "${term}"`;
    if (ids.has(id)) errors.push(`${where}: trùng id ${id}`);
    ids.add(id);
    if (!id.startsWith(`${u.id}-`)) errors.push(`${where}: id không có tiền tố unit`);
    if (!term.trim()) errors.push(`${where}: thiếu từ`);
    if (!meaning.trim()) errors.push(`${where}: thiếu nghĩa`);
    if (ipa && !/^\/[^/]+\/( or \/[^/]+\/)?$/.test(ipa)) errors.push(`${where}: IPA sai định dạng ${ipa}`);
    if (category === 'word' && !ipa) warnings.push(`${where}: từ đơn chưa có IPA`);
    if (!pos) warnings.push(`${where}: thiếu từ loại`);
    if (/\btobe\b|\bsmth\b|\bgt\b/.test(term)) errors.push(`${where}: còn lỗi gõ PDF`);
    if (acceptedAnswers(term).length === 0) errors.push(`${where}: không sinh được đáp án gõ`);
    cats.add(category);
  }
  for (const c of ['word', 'phrasal-verb', 'phrase']) {
    if (!cats.has(c)) warnings.push(`${u.id}: không có mục nhóm ${c}`);
  }
  console.log(`${u.id} ${u.title.padEnd(28)} ${String(u.words.length).padStart(3)} mục`);
}

// Answer-matching rules (spelling mode)
const cases: [string, string, boolean][] = [
  ['go back (to)', 'go back', true],
  ['go back (to)', 'Go back to', true],
  ['get on(to)', 'get onto', true],
  ['get on(to)', 'get on', true],
  ['cheat at/ in', 'cheat in', true],
  ['help sb with sth', 'help with', true],
  ['help sb with sth', 'help somebody with something', true],
  ['be keen on', 'be keen', false],
  ['let (sb) down', 'let down', true],
  ['in your teens/ twenties', 'in your twenties', true],
  ['bad-tempered', 'bad tempered', true],
  ['a number of', 'number of', false],
];
for (const [term, input, expected] of cases) {
  if (isCorrectAnswer(input, term) !== expected) {
    errors.push(`luật chấm: "${input}" với "${term}" phải là ${expected} (đáp án: ${acceptedAnswers(term).join(' | ')})`);
  }
}
if (toSpeakText('compare sth to/ with') !== 'compare something to or with') {
  errors.push(`toSpeakText sai: ${toSpeakText('compare sth to/ with')}`);
}

console.log(`\nTổng: ${total} mục, ${RAW_UNITS.length} unit`);

// ---- exam papers (src/data/exams/*.json)
const examDir = new URL('../src/data/exams/', import.meta.url);
const examIds = new Set<string>();
const questionIds = new Set<string>();
console.log('\nĐề thi:');
for (const file of readdirSync(examDir).filter((f) => f.endsWith('.json')).sort()) {
  let exam: Exam;
  try {
    exam = JSON.parse(readFileSync(new URL(file, examDir), 'utf8'));
  } catch (err) {
    errors.push(`${file}: JSON lỗi: ${(err as Error).message}`);
    continue;
  }
  const r = checkExam(exam, file.slice(0, -'.json'.length));
  errors.push(...r.errors);
  warnings.push(...r.warnings);
  if (examIds.has(exam.id)) errors.push(`${file}: trùng id đề ${exam.id}`);
  examIds.add(exam.id);
  const qs = exam.sections?.flatMap((x) => x.questions ?? []) ?? [];
  for (const q of qs) {
    if (questionIds.has(q.id)) errors.push(`${file}: câu ${q.id} trùng với đề khác`);
    questionIds.add(q.id);
  }
  console.log(`${exam.id.padEnd(32)} ${String(exam.sections?.length ?? 0).padStart(2)} phần ${String(qs.length).padStart(4)} câu${r.missingKeys ? `, ${r.missingKeys} câu chưa có đáp án` : ''}`);
}

// Scoring rules for typed exam answers
const typed = (answers: string[], extra: Partial<Question> = {}): Question => ({ id: 'x', prompt: '', answers, ...extra });
const gradeCases: [QuestionType, Question, string, boolean][] = [
  ['word-form', typed(['carelessly']), ' Carelessly ', true],
  ['word-form', typed(['carelessly']), 'careless', false],
  ['verb-form', typed(['had left']), 'had  left.', true],
  ['verb-form', typed(["doesn't go"]), 'does not go', true],
  ['verb-form', typed(['does not go']), 'doesn’t go', true],
  ['verb-form', typed(["won't come"]), 'will not come', true],
  ['cloze-open', typed(['get/ receive']), 'receive', true],
  ['cloze-open', typed(['get/ receive']), 'get receive', false],
  ['transform', typed(['She said (that) she was tired']), 'She said she was tired.', true],
  ['transform', typed(['She said (that) she was tired']), 'she said that she was tired', true],
  ['transform', typed(['I have never visited Hue before'], { lead: 'I have never' }), 'visited Hue before', true],
  ['transform', typed(['I have never visited Hue before'], { lead: 'I have never' }), 'I have never visited Hue before.', true],
  ['transform', typed(['I have never visited Hue before'], { lead: 'I have never' }), 'visited Hue', false],
  ['mcq', typed(['C'], { options: ['a', 'b', 'c', 'd'] }), 'c', true],
  ['mcq', typed(['C'], { options: ['a', 'b', 'c', 'd'] }), 'B', false],
  ['reading', typed(['B'], { options: ['True', 'False'] }), 'B', true],
  ['word-form', typed(['self-confident']), 'self - confident', true],
];
for (const [type, q, input, expected] of gradeCases) {
  if (gradeAnswer(q, type, input) !== expected) {
    errors.push(`luật chấm đề: "${input}" với ${JSON.stringify(q.answers)} (${type}) phải là ${expected}; chuẩn hóa: "${normalizeText(input)}"`);
  }
}
if (gradeAnswer(typed([]), 'word-form', 'x') !== null) errors.push('luật chấm đề: câu không có đáp án phải là null (không tính điểm)');
if (gradeAnswer(typed([]), 'writing', 'My hobby…') !== null) errors.push('luật chấm đề: bài viết phải là null (tự chấm)');

// Whole-paper scoring on the sample paper: all right → full marks once writing is self-scored
const sample: Exam = JSON.parse(readFileSync(new URL('mau-01.json', examDir), 'utf8'));
const perfect = Object.fromEntries(sample.sections.flatMap((x) => x.questions.map((q) => [q.id, q.lead ? q.answers[0].replace(/\(.*?\)\s*/g, '') : q.answers[0]?.split('/')[0] ?? ''])));
const full = scoreExam(sample, perfect, { s11: 3 });
if (full.score !== sample.maxScore) errors.push(`scoreExam: làm đúng hết phải được ${sample.maxScore}, ra ${full.score} (${JSON.stringify(full.sections)})`);
const none = scoreExam(sample, {});
if (none.score !== 0 || none.gradedMax !== 17) errors.push(`scoreExam: bài trống phải 0/17 điểm tự chấm, ra ${none.score}/${none.gradedMax}`);
const capped = scoreExam(sample, {}, { s11: 99 });
if (capped.score !== 3) errors.push(`scoreExam: tự chấm phải bị giới hạn ở điểm của phần, ra ${capped.score}`);
console.log(`\nTổng: ${examIds.size} đề, ${questionIds.size} câu`);
for (const w of warnings) console.log(`⚠️  ${w}`);
for (const e of errors) console.log(`❌ ${e}`);
if (errors.length) process.exit(1);
console.log('✅ Dữ liệu hợp lệ');
