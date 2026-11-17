// Validate an imported exam paper. Used by `npm run check:data` and (later) the import preview page.
import type { Exam } from '../types/exam';
// `.ts` extensions so plain Node (check:data) can load it too.
import { QUESTION_TYPES } from '../types/exam.ts';
import { expandAnswer, isChoice, LETTERS, normalizeChoice, questionType } from './grade.ts';

/** Same rule as progress ids in state.ts: anything else would be dropped when saving. */
const ID_RE = /^[a-z0-9-]{1,80}$/;

export interface ExamIssues {
  errors: string[];
  warnings: string[];
  /** questions that will be shown but not scored because the paper had no key */
  missingKeys: number;
}

export function checkExam(exam: Exam, fileId?: string): ExamIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  let missingKeys = 0;
  const e = (msg: string) => errors.push(`${exam.id}: ${msg}`);
  const w = (msg: string) => warnings.push(`${exam.id}: ${msg}`);

  if (!ID_RE.test(exam.id ?? '')) e(`id "${exam.id}" chỉ được có chữ thường, số và dấu "-"`);
  if (fileId !== undefined && fileId !== exam.id) e(`tên file (${fileId}.json) phải trùng id`);
  if (!exam.title?.trim()) e('thiếu tiêu đề');
  if (!(exam.minutes > 0)) e('minutes phải > 0');
  if (!(exam.maxScore > 0)) e('maxScore phải > 0');
  if (!exam.source?.trim()) w('thiếu source (tên file gốc)');
  if (!Array.isArray(exam.sections) || !exam.sections.length) {
    e('không có phần nào');
    return { errors, warnings, missingKeys };
  }

  const sectionIds = new Set<string>();
  const questionIds = new Set<string>();
  let total = 0;
  for (const s of exam.sections) {
    const at = `phần ${s.id}`;
    if (!/^[a-z0-9]{1,10}$/.test(s.id ?? '')) e(`${at}: id phần chỉ gồm chữ thường và số, tối đa 10 ký tự`);
    if (sectionIds.has(s.id)) e(`${at}: trùng id phần`);
    sectionIds.add(s.id);
    if (!QUESTION_TYPES.includes(s.type)) e(`${at}: dạng bài "${s.type}" không hợp lệ`);
    if (!(s.points >= 0)) e(`${at}: points phải ≥ 0`);
    total += s.points ?? 0;
    if (!s.instruction?.trim()) w(`${at}: thiếu yêu cầu đề`);
    if ((s.type === 'cloze-mcq' || s.type === 'cloze-open' || s.type === 'reading') && !s.passage?.trim()) w(`${at}: dạng đọc nhưng chưa có đoạn văn`);
    if (!s.questions?.length) {
      e(`${at}: không có câu hỏi`);
      continue;
    }

    for (const q of s.questions) {
      const qa = `câu ${q.id}`;
      const type = questionType(q, s);
      if (!ID_RE.test(q.id ?? '')) e(`${qa}: id không hợp lệ`);
      else if (!q.id.startsWith(`${exam.id}-${s.id}-`)) e(`${qa}: id phải bắt đầu bằng "${exam.id}-${s.id}-"`);
      if (questionIds.has(q.id)) e(`${qa}: trùng id`);
      questionIds.add(q.id);
      if (q.type && !QUESTION_TYPES.includes(q.type)) e(`${qa}: dạng bài "${q.type}" không hợp lệ`);
      if (!Array.isArray(q.answers)) {
        e(`${qa}: thiếu mảng answers (để [] nếu không có đáp án)`);
        continue;
      }
      if (!q.prompt?.trim() && !q.options?.length && type !== 'cloze-open') w(`${qa}: đề trống`);

      const choice = isChoice(q, type);
      if (choice) {
        const n = q.options?.length ?? 0;
        if (n < 2) e(`${qa}: dạng chọn đáp án nhưng có ${n} lựa chọn`);
        for (const a of q.answers) {
          const i = LETTERS.indexOf(normalizeChoice(a));
          if (normalizeChoice(a).length !== 1 || i < 0 || i >= n) e(`${qa}: đáp án "${a}" không phải lựa chọn A–${LETTERS[Math.max(n - 1, 0)]}`);
        }
      } else if (type !== 'writing') {
        for (const a of q.answers) if (!expandAnswer(a).length) e(`${qa}: đáp án rỗng`);
      }
      if (type === 'pronunciation' && q.options?.some((o) => !/<u>.+?<\/u>/.test(o))) e(`${qa}: dạng phát âm nhưng có lựa chọn thiếu <u>…</u>`);
      if (type === 'error-id' && (q.prompt.match(/<u>/g)?.length ?? 0) !== (q.options?.length ?? 0)) {
        w(`${qa}: tìm lỗi sai: số phần gạch chân <u>…</u> trong câu phải bằng số lựa chọn`);
      }
      if (type === 'writing' && !q.sample) w(`${qa}: bài viết chưa có bài mẫu`);
      if (type !== 'writing' && !q.answers.length) missingKeys++;
    }
  }
  if (Math.abs(total - exam.maxScore) > 0.01) e(`tổng điểm các phần (${total}) khác maxScore (${exam.maxScore})`);
  if (missingKeys) w(`${missingKeys} câu chưa có đáp án (sẽ không tính điểm)`);
  return { errors, warnings, missingKeys };
}
