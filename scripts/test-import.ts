// Run: npm run test:import — the paper importer on the fixtures and on the layouts real papers use.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mammoth from 'mammoth';
import { checkExam } from '../src/lib/exam-check.ts';
import { cleanLines, detectType, htmlToLines, parsePaper, splitOptions } from '../src/lib/exam-import.ts';
import { scoreExam } from '../src/lib/grade.ts';

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
};
const fixture = (f: string) => new URL(`./fixtures/${f}`, import.meta.url);
const opts = { id: 'thu', source: 'de-thu' };

await test('đề mẫu .txt: đủ 9 phần, đúng dạng, điểm, đáp án; không lỗi check:data', () => {
  const { exam, warnings } = parsePaper(cleanLines(readFileSync(fixture('de-thu.txt'), 'utf8').split('\n')), opts);
  assert.deepEqual(
    exam.sections.map((s) => [s.type, s.questions.length, s.points]),
    [['pronunciation', 2, 1], ['stress', 2, 1], ['mcq', 3, 3], ['word-form', 2, 2], ['error-id', 1, 1], ['cloze-open', 2, 2], ['reading', 2, 2], ['transform', 2, 2], ['writing', 1, 6]],
  );
  assert.equal(exam.minutes, 120);
  assert.equal(exam.year, 2024);
  assert.match(exam.title, /HỌC SINH GIỎI LỚP 8/);
  assert.equal(warnings.filter((w) => !w.startsWith('Bỏ dòng tiêu đề nhóm')).length, 0, warnings.join('\n'));
  const q = (s: number, i: number) => exam.sections[s].questions[i];
  assert.deepEqual(q(0, 0).options, ['b<u>oo</u>k', 'f<u>oo</u>d', 'l<u>oo</u>k', 'g<u>oo</u>d']);
  assert.deepEqual(q(2, 2).options, ['in', 'on', 'at', 'with'], 'lựa chọn mỗi cái một dòng');
  assert.deepEqual([q(4, 0).answers, q(4, 0).fix, q(4, 0).options?.length], [['A'], ["doesn't"], 4]);
  assert.deepEqual([q(5, 1).prompt, q(5, 1).answers], ['(12)', ['get/ receive']]);
  assert.deepEqual([q(6, 0).answers, q(6, 1).answers], [['B'], ['A']], 'T/F → A/B');
  assert.deepEqual([q(7, 0).lead, q(7, 1).lead], ['I have never', 'She said']);
  assert.deepEqual(checkExam(exam, 'thu').errors, []);
  // a student who answers like the key gets full marks except the self-scored writing
  const answers = Object.fromEntries(exam.sections.flatMap((s) => s.questions.map((x) => [x.id, x.answers[0]?.split('/')[0] ?? ''])));
  assert.equal(scoreExam(exam, answers).score, 14);
});

await test('đề mẫu .docx (gạch chân thật, lựa chọn trong bảng) cho kết quả y như .txt', async () => {
  const { value } = await mammoth.convertToHtml({ path: fixture('de-thu.docx').pathname }, { styleMap: ['u => u'] });
  const fromDocx = parsePaper(htmlToLines(value), opts).exam;
  const fromTxt = parsePaper(cleanLines(readFileSync(fixture('de-thu.txt'), 'utf8').split('\n')), opts).exam;
  assert.deepEqual(fromDocx, fromTxt);
});

await test('Word tự đánh số: <ol><li> lấy lại số câu, danh sách lồng nhau thành A. B. C. D.', () => {
  const html =
    '<p>I. Choose the best answer A, B, C or D. (2 points)</p>' +
    '<ol><li>She <u>is</u> tall.<ol><li>is</li><li>are</li><li>am</li><li>be</li></ol></li><li>Pick one.<ol><li>x</li><li>y</li></ol></li></ol>' +
    '<table><tr><td><p>A. one</p></td><td><p>B. two</p></td></tr></table><p>Tom &amp; Jerry&nbsp;</p>';
  assert.deepEqual(htmlToLines(html), ['I. Choose the best answer A, B, C or D. (2 points)', '1. She <u>is</u> tall.', 'A. is', 'B. are', 'C. am', 'D. be', '2. Pick one.', 'A. x', 'B. y', 'A. one B. two', 'Tom & Jerry']);
});

await test('số câu bắt đầu lại ở mỗi phần + đáp án ở file riêng có chia phần', () => {
  const paper = ['Thời gian: 90 phút', 'I. Choose the best answer. (1 point)', '1. a A. x B. y', '2. b A. x B. y', 'II. Give the correct form of the words in brackets. (1 point)', '1. (HAPPY) She is ___.', '2. (SAD) ___'];
  const key = ['Câu I', '1. A 2. B', 'Câu II', '1. happy 2. sadly'];
  const { exam, warnings } = parsePaper(paper, { ...opts, keyLines: key, maxScore: 2 });
  assert.deepEqual(exam.sections.map((s) => s.questions.map((q) => q.answers[0])), [['A', 'B'], ['happy', 'sadly']]);
  assert.equal(exam.minutes, 90);
  assert.deepEqual(warnings, []);
});

await test('đề không ghi điểm: chia đều theo số câu, có cảnh báo; đáp án viết liền "1B 2C"', () => {
  const paper = ['I. Choose the best answer.', '1. q A. a B. b C. c', '2. q A. a B. b C. c', '3. q A. a B. b C. c', 'II. Choose the best answer.', '4. q A. a B. b', 'ANSWER KEY', '1B 2C 3A 4B'];
  const { exam, warnings } = parsePaper(paper, { ...opts, maxScore: 10 });
  assert.deepEqual(exam.sections.map((s) => s.points), [7.5, 2.5]);
  assert.ok(warnings.some((w) => w.includes('chia 10 điểm')));
  assert.deepEqual(exam.sections.flatMap((s) => s.questions.map((q) => q.answers[0])), ['B', 'C', 'A', 'B']);
});

await test('nhiều câu đáp án viết lại cách nhau " / " thành nhiều đáp án; "get/ receive" vẫn là một', () => {
  const paper = ['I. Rewrite the sentences. (1 point)', '1. He is too young to drive.', 'ĐÁP ÁN', 'I. 1. He is not old enough to drive / He isn\'t old enough to drive'];
  const { exam } = parsePaper(paper, { ...opts, maxScore: 1 });
  assert.deepEqual(exam.sections[0].questions[0].answers, ['He is not old enough to drive', "He isn't old enough to drive"]);
});

await test('nhận dạng bài theo yêu cầu đề', () => {
  const cases: [string, string | undefined][] = [
    ['Choose the word whose underlined part is pronounced differently from the others.', 'pronunciation'],
    ['Choose the word that has a different stress pattern.', 'stress'],
    ['Put the verbs in brackets into the correct tense.', 'verb-form'],
    ['Use the correct form of the word given in capitals to complete each sentence.', 'word-form'],
    ['Fill in each blank with a suitable preposition.', 'preposition'],
    ['Finish each of the following sentences in such a way that it means the same as the sentence printed before it.', 'transform'],
    ['Read the following passage and choose the best answer to fill in each blank.', 'cloze-mcq'],
    ['Read the passage and answer the questions.', 'reading'],
    ['Each sentence has a mistake. Find and correct it.', 'error-id'],
    ['Write a letter to your friend (about 120 words).', 'writing'],
    ['Something else entirely.', undefined],
  ];
  for (const [text, want] of cases) assert.equal(detectType(text), want, text);
});

await test('tách lựa chọn: chữ cái phải theo thứ tự A, B, C…; "Mr. A. Smith" không bị cắt nhầm', () => {
  assert.deepEqual(splitOptions('Pick. A. go B. went C. gone D. going'), { before: 'Pick.', options: ['go', 'went', 'gone', 'going'] });
  assert.equal(splitOptions('I met Mr. A. Smith yesterday.'), null);
});

console.log(`\n${passed} test đều qua`);
