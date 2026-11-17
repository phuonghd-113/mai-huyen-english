// Run: npm run import:exam -- <file.docx|file.txt> [--key dapan.docx] [--id hsg8-2024-huyen-x] [--title "…"]
//        [--minutes 120] [--max 20] [--year 2024] [--level truong|huyen|tinh] [--force]
// Writes src/data/exams/<id>.json and lists everything that needs a human look.
// Then: npm run check:data, and open #/admin/exam/<id> with `npm run dev` to proofread.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { parseArgs } from 'node:util';
import mammoth from 'mammoth';
import { checkExam } from '../src/lib/exam-check.ts';
import { cleanLines, htmlToLines, parsePaper } from '../src/lib/exam-import.ts';
import type { ExamLevel } from '../src/types/exam.ts';
import { QUESTION_TYPE_LABEL } from '../src/types/exam.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    key: { type: 'string' },
    id: { type: 'string' },
    title: { type: 'string' },
    minutes: { type: 'string' },
    max: { type: 'string' },
    year: { type: 'string' },
    level: { type: 'string' },
    out: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
});

const file = positionals[0];
if (!file) {
  console.log('Cách dùng: npm run import:exam -- <đề.docx|đề.txt> [--key đáp-án.docx] [--id ten-de] [--minutes 120] [--max 20] [--year 2024] [--level huyen] [--force]');
  process.exit(1);
}

async function readLines(path: string): Promise<string[]> {
  const ext = extname(path).toLowerCase();
  if (ext === '.docx') {
    // mammoth drops underline unless asked: keep it, it marks pronunciation and error-identification parts
    const { value, messages } = await mammoth.convertToHtml({ path }, { styleMap: ['u => u'] });
    for (const m of messages) if (m.type === 'error') console.log(`⚠️  ${basename(path)}: ${m.message}`);
    return htmlToLines(value);
  }
  if (ext === '.txt' || ext === '.md') return cleanLines(readFileSync(path, 'utf8').split(/\r?\n/));
  if (ext === '.pdf') {
    console.log('❌ Chưa hỗ trợ PDF. Mở PDF bằng Word (File → Open) rồi lưu thành .docx, hoặc gửi file mẫu để bổ sung.');
    process.exit(1);
  }
  if (ext === '.doc') {
    console.log('❌ File .doc đời cũ: mở bằng Word rồi lưu thành .docx.');
    process.exit(1);
  }
  console.log(`❌ Không đọc được loại file ${ext}.`);
  process.exit(1);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const id = values.id ?? slug(basename(file, extname(file)));
const level = values.level as ExamLevel | undefined;
if (level && !['truong', 'huyen', 'tinh'].includes(level)) {
  console.log('❌ --level phải là truong, huyen hoặc tinh.');
  process.exit(1);
}
const num = (v?: string) => (v === undefined ? undefined : Number(v.replace(',', '.')));

const lines = await readLines(file);
const keyLines = values.key ? await readLines(values.key) : undefined;
const { exam, warnings } = parsePaper(lines, {
  id,
  source: basename(file),
  title: values.title,
  minutes: num(values.minutes),
  maxScore: num(values.max),
  year: num(values.year),
  level,
  keyLines,
});

const out = values.out ?? new URL(`../src/data/exams/${id}.json`, import.meta.url).pathname;
if (existsSync(out) && !values.force) {
  console.log(`❌ ${out} đã có. Thêm --force để ghi đè (tiến độ đã lưu theo id câu hỏi vẫn giữ nếu cấu trúc đề không đổi).`);
  process.exit(1);
}
writeFileSync(out, JSON.stringify(exam, null, 2) + '\n');

console.log(`\n${exam.title}`);
console.log(`id: ${exam.id} · ${exam.minutes} phút · ${exam.maxScore} điểm${exam.year ? ` · ${exam.year}` : ''}\n`);
for (const s of exam.sections) {
  const keyed = s.questions.filter((q) => q.answers.length).length;
  const label = QUESTION_TYPE_LABEL[s.type].padEnd(16);
  console.log(`${s.id.padEnd(4)} ${label} ${String(s.questions.length).padStart(3)} câu  ${String(s.points).padStart(5)} đ  đáp án ${keyed}/${s.questions.length}  ${s.instruction.slice(0, 60)}`);
}
const check = checkExam(exam, id);
const all = [...warnings.map((w) => `⚠️  ${w}`), ...check.warnings.map((w) => `⚠️  ${w}`), ...check.errors.map((e) => `❌ ${e}`)];
if (all.length) console.log(`\nCần xem lại (${all.length}):`);
for (const l of all) console.log(l);
console.log(`\nĐã ghi ${out}`);
console.log('Tiếp theo: soát đề ở #/admin/exam/' + id + ' (npm run dev), sửa JSON nếu cần, rồi npm run check:data.');
if (check.errors.length) process.exit(2);
