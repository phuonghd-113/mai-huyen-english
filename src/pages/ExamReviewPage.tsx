import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card, Segmented } from '../components/common';
import { ExamLoading, ExamMissing } from '../components/exam/ExamStatus';
import { SectionView } from '../components/exam/SectionView';
import { MobileHeader } from '../components/Layout';
import { countWords, formatDate, formatScore, resultOf, sectionLabel, useExam } from '../lib/exam-ui';
import { gradeAnswer, questionType, type SectionResult } from '../lib/grade';
import { useProgress } from '../lib/progress';
import { href } from '../lib/router';
import { cx } from '../lib/ui';
import { QUESTION_TYPE_LABEL, type Exam, type ExamAttempt, type Section } from '../types/exam';

export function ExamReviewPage({ examId, attemptId }: { examId: string; attemptId: string }) {
  const loaded = useExam(examId);
  const { state } = useProgress();
  const attempt = state.attempts[attemptId];
  if (loaded.status === 'loading') return <ExamLoading />;
  if (loaded.status === 'error' || !loaded.data) return <ExamMissing failed={loaded.status === 'error'} />;
  if (!attempt || attempt.examId !== examId) return <ExamMissing title="Không tìm thấy bài làm" />;
  if (!attempt.submittedAt) return <ExamMissing title="Bài này chưa nộp: mở đề để làm tiếp" />;
  return <Review exam={loaded.data} attempt={attempt} />;
}

type Filter = 'all' | 'wrong';

function Review({ exam, attempt }: { exam: Exam; attempt: ExamAttempt }) {
  const [filter, setFilter] = useState<Filter>('all');
  const result = useMemo(() => resultOf(exam, attempt), [exam, attempt]);
  const pct = result.max ? result.score / result.max : 0;
  const usedMs = exam.minutes * 60_000 - (attempt.remainingMs ?? 0);
  const selfScored = exam.sections.map((s, i) => ({ s, i, r: result.sections[i] })).filter(({ r }) => r.gradable < r.total);
  const pendingSelf = selfScored.filter(({ s }) => attempt.selfScores?.[s.id] === undefined);
  const wrongCount = result.sections.reduce((n, r) => n + (r.gradable - r.correct), 0);

  return (
    <>
      <MobileHeader title="Kết quả" back={href.exams()} />
      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6 md:px-8 md:pt-10">
        <a href={href.exams()} className="hidden items-center gap-1.5 text-[15px] text-slate-600 hover:text-slate-900 md:inline-flex">
          <ArrowLeft className="h-4 w-4" /> Danh sách đề
        </a>
        <div className="mt-2 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-[26px] leading-tight text-slate-900 md:text-[32px]">{exam.title}</h1>
            <p className="mt-1 text-[15px] text-slate-600">
              Nộp lúc {formatDate(attempt.submittedAt!)} · làm trong {Math.max(1, Math.round(usedMs / 60_000))} phút
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cx('font-display text-[56px] font-semibold leading-none tabular-nums', pct >= 0.8 ? 'text-indigo-700' : 'text-slate-900')}>
              {formatScore(result.score)}
            </span>
            <span className="text-xl text-slate-500">/ {formatScore(result.max)} điểm</span>
          </div>
        </div>
        {pendingSelf.length > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
            Điểm này chưa gồm phần viết ({pendingSelf.map(({ i }) => `phần ${sectionLabel(i)}`).join(', ')}). Đọc bài mẫu bên dưới rồi tự chấm để có điểm đầy đủ.
          </p>
        )}

        <Card className="mt-6 overflow-hidden">
          <table className="w-full text-left text-[15px]">
            <thead className="text-[13px] text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 md:px-4 font-medium">Phần</th>
                <th className="px-3 py-2 md:px-4 font-medium">Dạng bài</th>
                <th className="px-3 py-2 md:px-4 text-right font-medium">Đúng</th>
                <th className="px-3 py-2 md:px-4 text-right font-medium">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {exam.sections.map((s, i) => (
                <SectionRow key={s.id} s={s} i={i} r={result.sections[i]} self={attempt.selfScores?.[s.id]} />
              ))}
            </tbody>
          </table>
        </Card>

        {selfScored.map(({ s, i, r }) => (
          <SelfScore key={s.id} exam={exam} attempt={attempt} section={s} index={i} result={r} />
        ))}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl text-slate-900">Xem lại bài</h2>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            label="Lọc câu"
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'wrong', label: `Câu sai (${wrongCount})` },
            ]}
          />
        </div>
        <div className="mt-4 space-y-10">
          {exam.sections.map((s, i) => {
            const only = filter === 'wrong' ? (q: Section['questions'][number]) => gradeAnswer(q, questionType(q, s), attempt.answers[q.id]) === false : undefined;
            if (only && !s.questions.some(only)) return null;
            return <SectionView key={s.id} section={s} index={i} answers={attempt.answers} only={only} />;
          })}
          {filter === 'wrong' && wrongCount === 0 && <p className="text-[16px] text-slate-600">Không có câu sai.</p>}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-6 sm:flex-row">
          <a href={href.exam(exam.id)} className="btn-step inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700">
            <RotateCcw className="h-4 w-4" /> Làm lại đề này
          </a>
          <a href={href.exams()} className="btn-step inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-800 hover:border-slate-500">
            Chọn đề khác
          </a>
        </div>
      </main>
    </>
  );
}

function SectionRow({ s, i, r, self }: { s: Section; i: number; r: SectionResult; self?: number }) {
  const waiting = r.gradable < r.total && self === undefined;
  return (
    <tr>
      <td className="px-3 py-2.5 md:px-4 font-display font-semibold text-slate-500">{sectionLabel(i)}</td>
      <td className="px-3 py-2.5 md:px-4 text-slate-800">{QUESTION_TYPE_LABEL[s.type]}</td>
      <td className="px-3 py-2.5 md:px-4 text-right text-slate-700">{r.gradable ? `${r.correct}/${r.gradable}` : '—'}</td>
      <td className="px-3 py-2.5 md:px-4 text-right">
        {waiting ? (
          <span className="text-amber-700">tự chấm</span>
        ) : (
          <>
            <b className="font-semibold text-slate-900">{formatScore(r.score)}</b>
            <span className="text-slate-500"> / {formatScore(r.max)}</span>
          </>
        )}
      </td>
    </tr>
  );
}

const CHECKLIST = [
  'Viết đúng chủ đề, đủ các ý đề yêu cầu',
  'Đủ số từ quy định',
  'Có câu chủ đề, các ý sắp xếp hợp lý, có từ nối',
  'Dùng đúng thì và cấu trúc câu',
  'Từ vựng phù hợp, không sai chính tả',
];

function SelfScore({ exam, attempt, section, index, result }: { exam: Exam; attempt: ExamAttempt; section: Section; index: number; result: SectionResult }) {
  const { saveAttempt } = useProgress();
  const each = section.questions.length ? section.points / section.questions.length : 0;
  const max = Math.round((section.points - result.gradable * each) * 100) / 100;
  const saved = attempt.selfScores?.[section.id];
  const [draft, setDraft] = useState(saved === undefined ? '' : String(saved).replace('.', ','));
  const parsed = Number(draft.replace(',', '.'));
  const valid = draft.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed <= max;
  const words = section.questions.reduce((n, q) => n + countWords(attempt.answers[q.id] ?? ''), 0);

  const save = () => {
    if (!valid) return;
    const selfScores = { ...attempt.selfScores, [section.id]: parsed };
    saveAttempt({ ...attempt, selfScores, score: resultOf(exam, { ...attempt, selfScores }).score });
  };

  return (
    <Card className="mt-6 p-4 md:p-6">
      <h2 className="text-xl text-slate-900">Tự chấm phần {sectionLabel(index)}</h2>
      <p className="mt-1 text-[15px] text-slate-600">
        Bài của bạn có {words} từ. So với bài mẫu ở phần xem lại bên dưới, rồi cho điểm theo các tiêu chí sau. Mỗi tiêu chí khoảng {formatScore(Math.round((max / CHECKLIST.length) * 100) / 100)} điểm.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] text-slate-800">
        {CHECKLIST.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[15px] text-slate-700">
          Điểm
          <input
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="h-11 w-24 rounded-xl border border-slate-300 bg-white px-3 text-[17px] tabular-nums outline-none focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-100"
            aria-describedby={`self-max-${section.id}`}
          />
          <span id={`self-max-${section.id}`}>/ {formatScore(max)}</span>
        </label>
        <button
          type="button"
          onClick={save}
          disabled={!valid || parsed === saved}
          className="btn-step inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 text-[15px] font-semibold text-white hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-40"
        >
          {saved === undefined ? 'Lưu điểm' : 'Cập nhật'}
        </button>
        {draft.trim() !== '' && !valid && <span className="text-[14px] text-red-700">Nhập số từ 0 đến {formatScore(max)}.</span>}
        {saved !== undefined && valid && parsed === saved && <span className="text-[14px] text-slate-500">Đã tính vào tổng điểm.</span>}
      </div>
    </Card>
  );
}
