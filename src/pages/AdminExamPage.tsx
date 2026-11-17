import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Card } from '../components/common';
import { ExamLoading, ExamMissing } from '../components/exam/ExamStatus';
import { SectionView } from '../components/exam/SectionView';
import { MobileHeader } from '../components/Layout';
import { checkExam } from '../lib/exam-check';
import { fixKey, formatScore, sectionLabel, useExam } from '../lib/exam-ui';
import { isChoice, questionType } from '../lib/grade';
import { href } from '../lib/router';
import { QUESTION_TYPE_LABEL, type Exam } from '../types/exam';

/**
 * Proofreading an imported paper (dev only): problems on top, then the paper as a review page with the key
 * filled in as the "student's" answers. A key that does not match its options shows up red.
 */
export function AdminExamPage({ examId }: { examId: string }) {
  const loaded = useExam(examId);
  if (loaded.status === 'loading') return <ExamLoading />;
  if (loaded.status === 'error' || !loaded.data) return <ExamMissing failed={loaded.status === 'error'} title={`Không có src/data/exams/${examId}.json`} />;
  return <Preview exam={loaded.data} />;
}

function Preview({ exam }: { exam: Exam }) {
  const issues = useMemo(() => checkExam(exam, exam.id), [exam]);
  const answers = useMemo(() => {
    const a: Record<string, string> = {};
    for (const s of exam.sections) {
      for (const q of s.questions) {
        const first = q.answers[0];
        if (!first) continue;
        const choice = isChoice(q, questionType(q, s));
        // a typed key in its plainest accepted spelling: "(that)" dropped, first of "a/ b"
        a[q.id] = choice ? first : first.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/(\S+)\s*\/\s*\S+/g, '$1').trim();
        if (q.fix?.[0]) a[fixKey(q.id)] = q.fix[0];
      }
    }
    return a;
  }, [exam]);
  const total = exam.sections.reduce((n, s) => n + s.questions.length, 0);
  const sumPoints = exam.sections.reduce((n, s) => n + s.points, 0);

  return (
    <>
      <MobileHeader title="Xem trước đề" back={href.exams()} />
      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6 md:px-8 md:pt-10">
        <a href={href.exams()} className="hidden items-center gap-1.5 text-[15px] text-slate-600 hover:text-slate-900 md:inline-flex">
          <ArrowLeft className="h-4 w-4" /> Danh sách đề
        </a>
        <p className="mt-2 text-[13px] font-medium text-amber-800">Xem trước khi nhập đề · chỉ có khi chạy npm run dev</p>
        <h1 className="mt-1 text-[26px] leading-tight text-slate-900 md:text-[32px]">{exam.title}</h1>
        <p className="mt-1 font-mono text-[13px] text-slate-500">
          src/data/exams/{exam.id}.json · nguồn: {exam.source}
        </p>
        <p className="mt-2 text-[15px] text-slate-700">
          {exam.minutes} phút · {total} câu · tổng điểm các phần {formatScore(sumPoints)}/{formatScore(exam.maxScore)}
          {exam.year ? ` · ${exam.year}` : ''}
        </p>

        <Card className="mt-5 p-4">
          {issues.errors.length === 0 && issues.warnings.length === 0 ? (
            <p className="text-[15px] font-semibold text-indigo-700">Không có lỗi hay cảnh báo.</p>
          ) : (
            <ul className="space-y-1 text-[15px]">
              {issues.errors.map((e) => (
                <li key={e} className="text-red-700">
                  Lỗi: {e}
                </li>
              ))}
              {issues.warnings.map((w) => (
                <li key={w} className="text-amber-800">
                  Cần xem: {w}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="mt-4 overflow-hidden">
          <table className="w-full text-left text-[14px]">
            <thead className="text-[13px] text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 font-medium">Phần</th>
                <th className="px-3 py-2 font-medium">Dạng</th>
                <th className="px-3 py-2 text-right font-medium">Câu</th>
                <th className="px-3 py-2 text-right font-medium">Có đáp án</th>
                <th className="px-3 py-2 text-right font-medium">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {exam.sections.map((s, i) => {
                const keyed = s.questions.filter((q) => q.answers.length).length;
                return (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-semibold text-slate-600">
                      {sectionLabel(i)} <span className="font-mono text-[12px] font-normal text-slate-400">{s.id}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-800">{QUESTION_TYPE_LABEL[s.type]}</td>
                    <td className="px-3 py-2 text-right">{s.questions.length}</td>
                    <td className={keyed < s.questions.length && s.type !== 'writing' ? 'px-3 py-2 text-right font-semibold text-red-700' : 'px-3 py-2 text-right'}>{s.type === 'writing' ? '—' : `${keyed}/${s.questions.length}`}</td>
                    <td className="px-3 py-2 text-right">{formatScore(s.points)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div className="mt-8 space-y-10">
          {exam.sections.map((s, i) => (
            <SectionView key={s.id} section={s} index={i} answers={answers} />
          ))}
        </div>
      </main>
    </>
  );
}
