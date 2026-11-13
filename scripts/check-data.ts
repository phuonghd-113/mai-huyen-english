// Run: npm run check:data  (Node ≥ 22.18 runs TypeScript directly)
import { RAW_UNITS } from '../src/data/units.ts';
import { acceptedAnswers, isCorrectAnswer, toSpeakText } from '../src/lib/text.ts';

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
for (const w of warnings) console.log(`⚠️  ${w}`);
for (const e of errors) console.log(`❌ ${e}`);
if (errors.length) process.exit(1);
console.log('✅ Dữ liệu hợp lệ');
