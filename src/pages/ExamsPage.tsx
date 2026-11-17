import { ArrowRight, FileText, LoaderCircle, Play } from 'lucide-react';
import { Card, EmptyState } from '../components/common';
import { MobileHeader } from '../components/Layout';
import { attemptsOf, formatClock, formatDate, formatScore, resultOf, useAllExams } from '../lib/exam-ui';
import { useProgress } from '../lib/progress';
import { href } from '../lib/router';
import { cx } from '../lib/ui';
import type { Exam, ExamLevel } from '../types/exam';
import type { ProgressState } from '../types/vocab';

const LEVEL_LABEL: Record<ExamLevel, string> = { truong: 'Cấp trường', huyen: 'Cấp huyện', tinh: 'Cấp tỉnh' };

export function ExamsPage() {
  const loaded = useAllExams();
  const { state } = useProgress();
  return (
    <>
      <MobileHeader title="Thi thử" />
      <main className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6 md:px-8 md:pt-12">
        <h1 className="text-[32px] leading-tight text-slate-900 md:text-[44px]">Thi thử</h1>
        <p className="mt-2 max-w-2xl text-[16px] text-slate-600">Làm trọn một đề như thi thật: có tính giờ, nộp bài xong xem điểm và đáp án từng câu. Câu làm sai được đưa vào sổ lỗi sai.</p>

        {loaded.status === 'loading' && (
          <div className="flex justify-center p-10 text-slate-400">
            <LoaderCircle className="h-8 w-8 animate-spin" aria-label="Đang tải đề" />
          </div>
        )}
        {loaded.status === 'error' && (
          <div className="mt-6">
            <EmptyState icon={<FileText className="h-12 w-12" />} title="Không tải được danh sách đề">
              Kiểm tra kết nối mạng rồi tải lại trang.
            </EmptyState>
          </div>
        )}
        {loaded.status === 'ready' && (
          <>
            {loaded.data.length === 0 ? (
              <div className="mt-6">
                <EmptyState icon={<FileText className="h-12 w-12" />} title="Chưa có đề nào" />
              </div>
            ) : (
              <div className="mt-6 grid gap-3">
                {loaded.data.map((e) => (
                  <div key={e.id}>
                    <ExamCard exam={e} state={state} />
                    <DevPreviewLink examId={e.id} />
                  </div>
                ))}
              </div>
            )}
            <History exams={loaded.data} state={state} />
          </>
        )}
      </main>
    </>
  );
}

function ExamCard({ exam, state }: { exam: Exam; state: ProgressState }) {
  const attempts = attemptsOf(state, exam.id);
  const unfinished = attempts.find((a) => !a.submittedAt);
  const done = attempts.filter((a) => a.submittedAt);
  const best = done.length ? Math.max(...done.map((a) => resultOf(exam, a).score)) : undefined;
  const total = exam.sections.reduce((n, s) => n + s.questions.length, 0);
  const meta = [exam.year, exam.level && LEVEL_LABEL[exam.level], `${exam.minutes} phút`, `${total} câu`].filter(Boolean).join(' · ');
  return (
    <a href={href.exam(exam.id)} className="lift group block rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[19px] leading-snug text-slate-900">{exam.title}</h2>
            {exam.sample && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-semibold text-slate-600">Đề mẫu</span>}
          </div>
          <p className="mt-1 text-[15px] text-slate-600">{meta}</p>
          <p className="mt-2 text-[15px] text-slate-700">
            {best !== undefined ? (
              <>
                Điểm cao nhất <b className="font-semibold tabular-nums text-slate-900">{formatScore(best)}</b>/{formatScore(exam.maxScore)} · đã làm {done.length} lần
              </>
            ) : (
              'Chưa làm lần nào'
            )}
          </p>
        </div>
        <span
          className={cx(
            'mt-1 inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[15px] font-semibold',
            unfinished ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-800 group-hover:border-slate-500',
          )}
        >
          {unfinished ? (
            <>
              <Play className="h-4 w-4" /> Làm tiếp
            </>
          ) : (
            <>
              Làm đề <ArrowRight className="h-4 w-4" />
            </>
          )}
        </span>
      </div>
      {unfinished && <p className="mt-2 text-[14px] text-slate-500">Bài đang dở, còn {formatClock(unfinished.remainingMs ?? 0)}.</p>}
    </a>
  );
}

/** npm run dev only: proofread an imported paper. */
function DevPreviewLink({ examId }: { examId: string }) {
  if (!import.meta.env.DEV) return null;
  return (
    <a href={href.adminExam(examId)} className="mt-1 inline-block px-1 text-[13px] font-medium text-amber-800 hover:underline">
      Xem trước đề (dev)
    </a>
  );
}

function History({ exams, state }: { exams: Exam[]; state: ProgressState }) {
  const byId = new Map(exams.map((e) => [e.id, e]));
  // includes the hidden sample paper's attempts only if it is still listed
  const rows = Object.values(state.attempts)
    .filter((a) => a.submittedAt && !a.abandoned && byId.has(a.examId))
    .sort((a, b) => b.submittedAt! - a.submittedAt!)
    .slice(0, 10);
  if (!rows.length) return null;
  return (
    <section className="mt-12">
      <h2 className="text-2xl text-slate-900">Các lần làm gần đây</h2>
      <Card className="mt-4 divide-y divide-slate-100">
        {rows.map((a) => {
          const e = byId.get(a.examId)!;
          const r = resultOf(e, a);
          return (
            <a key={a.id} href={href.examReview(e.id, a.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-medium text-slate-900">{e.title}</div>
                <div className="text-[14px] text-slate-500">{formatDate(a.submittedAt!)}</div>
              </div>
              <span className="shrink-0 tabular-nums text-slate-600">
                <b className="text-[17px] font-semibold text-slate-900">{formatScore(r.score)}</b>/{formatScore(r.max)}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
            </a>
          );
        })}
      </Card>
    </section>
  );
}
