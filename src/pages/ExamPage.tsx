import { ArrowLeft, ArrowRight, Clock, Flag, Play, RotateCcw, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '../components/common';
import { ExamMissing, ExamLoading } from '../components/exam/ExamStatus';
import { SectionView } from '../components/exam/SectionView';
import { MobileHeader } from '../components/Layout';
import { formatClock, formatScore, newAttemptId, sectionLabel, unfinishedAttempt, useExam } from '../lib/exam-ui';
import { gradeAnswer, questionType, scoreExam } from '../lib/grade';
import { useProgress } from '../lib/progress';
import { href } from '../lib/router';
import { cx } from '../lib/ui';
import { QUESTION_TYPE_LABEL, type Exam, type ExamAttempt } from '../types/exam';

export function ExamPage({ examId }: { examId: string }) {
  const loaded = useExam(examId);
  if (loaded.status === 'loading') return <ExamLoading />;
  if (loaded.status === 'error' || !loaded.data) return <ExamMissing failed={loaded.status === 'error'} />;
  return <ExamRunner exam={loaded.data} />;
}

function ExamRunner({ exam }: { exam: Exam }) {
  const { state, saveAttempt } = useProgress();
  const [activeId, setActiveId] = useState<string | null>(null);
  const current = unfinishedAttempt(state, exam.id);
  const active = activeId ? state.attempts[activeId] : undefined;

  const start = () => {
    if (current) saveAttempt({ ...current, abandoned: true });
    const id = newAttemptId();
    saveAttempt({ id, examId: exam.id, startedAt: Date.now(), answers: {}, remainingMs: exam.minutes * 60_000 });
    setActiveId(id);
  };

  if (active) return <Sitting key={active.id} exam={exam} attempt={active} />;
  return <Intro exam={exam} current={current} onStart={start} onResume={() => current && setActiveId(current.id)} />;
}

function Intro({ exam, current, onStart, onResume }: { exam: Exam; current?: ExamAttempt; onStart: () => void; onResume: () => void }) {
  const total = exam.sections.reduce((n, s) => n + s.questions.length, 0);
  const answered = current ? Object.entries(current.answers).filter(([k, v]) => !k.endsWith('-fix') && v.trim()).length : 0;
  return (
    <>
      <MobileHeader title="Thi thử" back={href.exams()} />
      <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6 md:px-8 md:pt-12">
        <a href={href.exams()} className="hidden items-center gap-1.5 text-[15px] text-slate-600 hover:text-slate-900 md:inline-flex">
          <ArrowLeft className="h-4 w-4" /> Danh sách đề
        </a>
        <h1 className="mt-2 text-balance text-[28px] leading-tight text-slate-900 md:text-[36px]">{exam.title}</h1>
        <p className="mt-2 text-[16px] text-slate-600">
          {exam.minutes} phút · {total} câu · thang điểm {formatScore(exam.maxScore)}
        </p>

        <Card className="mt-6 divide-y divide-slate-100">
          {exam.sections.map((s, i) => (
            <div key={s.id} className="flex items-baseline gap-3 px-4 py-2.5">
              <span className="w-10 shrink-0 font-display font-semibold text-slate-500">{sectionLabel(i)}</span>
              <span className="min-w-0 flex-1 text-[15px] text-slate-800">{QUESTION_TYPE_LABEL[s.type]}</span>
              <span className="shrink-0 text-[15px] tabular-nums text-slate-600">
                {s.questions.length} câu · {formatScore(s.points)} đ
              </span>
            </div>
          ))}
        </Card>

        <ul className="mt-6 space-y-1.5 text-[15px] text-slate-700">
          <li>Bài làm được lưu liên tục. Thoát ra giữa chừng thì đồng hồ dừng, lần sau làm tiếp.</li>
          <li>Hết giờ, bài tự nộp. Có thể làm các phần theo thứ tự bất kỳ.</li>
          <li>Phần viết đoạn văn không chấm tự động: nộp xong bạn tự chấm theo bài mẫu.</li>
        </ul>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          {current ? (
            <>
              <Button onClick={onResume} className="min-h-[48px] px-6 text-base">
                <Play className="h-4 w-4" /> Làm tiếp · còn {formatClock(current.remainingMs ?? 0)}
              </Button>
              <Button variant="secondary" onClick={onStart} className="min-h-[48px] px-6 text-base">
                <RotateCcw className="h-4 w-4" /> Làm lại từ đầu
              </Button>
            </>
          ) : (
            <Button onClick={onStart} className="min-h-[48px] px-6 text-base">
              <Play className="h-4 w-4" /> Bắt đầu làm bài
            </Button>
          )}
        </div>
        {current && (
          <p className="mt-2 text-[14px] text-slate-500">
            Bài đang dở: đã làm {answered}/{total} câu. Làm lại từ đầu sẽ bỏ bài này.
          </p>
        )}
      </main>
    </>
  );
}

const SAVE_DELAY = 700;
const TIMER_SAVE_EVERY = 15_000;

function Sitting({ exam, attempt }: { exam: Exam; attempt: ExamAttempt }) {
  const progressApi = useProgress();
  // The progress functions change on every state change; keep `persist` stable so the effects below
  // (whose cleanup saves) do not re-run, and save, after each save.
  const api = useRef(progressApi);
  api.current = progressApi;
  // The sitting owns its answers; they are written back to progress shortly after each change.
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...attempt.answers }));
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set(attempt.flagged ?? []));
  const [sectionIdx, setSectionIdx] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const endAt = useRef(Date.now() + (attempt.remainingMs ?? exam.minutes * 60_000));
  const remaining = Math.max(0, endAt.current - now);

  const latest = useRef({ answers, flagged });
  latest.current = { answers, flagged };
  const done = useRef(false);

  const persist = useCallback(
    (extra: Partial<ExamAttempt> = {}) => {
      const { answers: a, flagged: f } = latest.current;
      api.current.saveAttempt({
        id: attempt.id,
        examId: attempt.examId,
        startedAt: attempt.startedAt,
        answers: Object.fromEntries(Object.entries(a).filter(([, v]) => v.trim())),
        flagged: f.size ? [...f] : undefined,
        remainingMs: Math.max(0, endAt.current - Date.now()),
        ...extra,
      });
    },
    [attempt.id, attempt.examId, attempt.startedAt],
  );

  // timer; saved now and then so a crash loses little. A hidden tab does not tick (see below).
  useEffect(() => {
    const tick = window.setInterval(() => document.visibilityState === 'visible' && setNow(Date.now()), 1000);
    const save = window.setInterval(() => !done.current && persist(), TIMER_SAVE_EVERY);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(save);
    };
  }, [persist]);

  // answers: debounced save
  useEffect(() => {
    const t = window.setTimeout(() => !done.current && persist(), SAVE_DELAY);
    return () => window.clearTimeout(t);
  }, [answers, flagged, persist]);

  // leaving the page or the tab: save, and the clock stops until the next visit
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        if (!done.current) persist();
      } else if (hiddenAt) {
        // time spent away does not count
        endAt.current += Date.now() - hiddenAt;
        hiddenAt = 0;
        setNow(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (!done.current) persist();
    };
  }, [persist]);

  const submit = useCallback(() => {
    if (done.current) return;
    done.current = true;
    const { answers: a } = latest.current;
    const res = scoreExam(exam, a);
    persist({ submittedAt: Date.now(), score: res.score });
    const results: [string, boolean][] = [];
    for (const s of exam.sections) {
      for (const q of s.questions) {
        const r = gradeAnswer(q, questionType(q, s), a[q.id]);
        if (r !== null) results.push([q.id, r]);
      }
    }
    api.current.recordQuestions(results);
    window.location.hash = href.examReview(exam.id, attempt.id);
  }, [exam, attempt.id, persist]);

  useEffect(() => {
    if (remaining <= 0) submit();
  }, [remaining, submit]);

  const onAnswer = useCallback((key: string, value: string) => setAnswers((a) => ({ ...a, [key]: value })), []);
  const onFlag = useCallback(
    (id: string) =>
      setFlagged((f) => {
        const n = new Set(f);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );

  const progress = useMemo(
    () =>
      exam.sections.map((s) => ({
        answered: s.questions.filter((q) => answers[q.id]?.trim()).length,
        flagged: s.questions.filter((q) => flagged.has(q.id)).length,
        total: s.questions.length,
      })),
    [exam, answers, flagged],
  );
  const answered = progress.reduce((n, p) => n + p.answered, 0);
  const total = progress.reduce((n, p) => n + p.total, 0);
  const section = exam.sections[sectionIdx];
  const last = sectionIdx === exam.sections.length - 1;
  const goSection = (i: number) => {
    setSectionIdx(i);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-2 md:px-6">
          <a href={href.exams()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Thoát (bài làm đã được lưu)">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[16px] font-semibold text-slate-900">{exam.title}</div>
            <div className="text-[13px] tabular-nums text-slate-500">
              Đã làm {answered}/{total} câu
            </div>
          </div>
          <span
            className={cx(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[15px] font-semibold tabular-nums',
              remaining < 60_000 ? 'bg-red-100 text-red-800' : remaining < 5 * 60_000 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800',
            )}
            role="timer"
            aria-label={`Còn ${formatClock(remaining)}`}
          >
            <Clock className="h-4 w-4" />
            {formatClock(remaining)}
          </span>
          <Button onClick={() => setConfirming(true)} className="hidden shrink-0 sm:inline-flex">
            <Send className="h-4 w-4" /> Nộp bài
          </Button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1.5 overflow-x-auto px-3 pb-2 md:px-6" aria-label="Các phần của đề">
          {exam.sections.map((s, i) => {
            const p = progress[i];
            const complete = p.answered === p.total;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goSection(i)}
                aria-current={i === sectionIdx ? 'step' : undefined}
                className={cx(
                  'relative flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[14px] font-semibold tabular-nums transition-colors',
                  i === sectionIdx ? 'border-slate-900 bg-slate-900 text-white' : complete ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400',
                )}
              >
                {sectionLabel(i)}
                <span className={cx('text-[12px] font-medium', i === sectionIdx ? 'text-slate-300' : 'text-slate-500')}>
                  {p.answered}/{p.total}
                </span>
                {p.flagged > 0 && <Flag className="h-3 w-3 text-amber-500" fill="currentColor" aria-label={`${p.flagged} câu đánh dấu`} />}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-5 md:px-6">
        <div className="mx-auto max-w-3xl md:max-w-none">
          <SectionView key={section.id} section={section} index={sectionIdx} answers={answers} onAnswer={onAnswer} flagged={flagged} onFlag={onFlag} />
        </div>
        <div className="mt-6 flex items-center gap-2 border-t border-slate-200 pt-4">
          <Button variant="secondary" onClick={() => goSection(sectionIdx - 1)} disabled={sectionIdx === 0}>
            <ArrowLeft className="h-4 w-4" /> Phần trước
          </Button>
          <span className="flex-1" />
          {last ? (
            <Button onClick={() => setConfirming(true)}>
              <Send className="h-4 w-4" /> Nộp bài
            </Button>
          ) : (
            <Button onClick={() => goSection(sectionIdx + 1)}>
              Phần sau <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        {!last && (
          <div className="mt-3 text-center sm:hidden">
            <button type="button" onClick={() => setConfirming(true)} className="min-h-[44px] px-4 text-[15px] font-semibold text-indigo-700">
              Nộp bài ngay
            </button>
          </div>
        )}
      </main>

      {confirming && (
        <ConfirmSubmit
          unanswered={total - answered}
          flagged={flagged.size}
          remaining={remaining}
          onCancel={() => setConfirming(false)}
          onSubmit={submit}
          onShowFirst={() => {
            setConfirming(false);
            const i = progress.findIndex((p) => p.answered < p.total);
            if (i >= 0) goSection(i);
          }}
        />
      )}
    </>
  );
}

function ConfirmSubmit({
  unanswered,
  flagged,
  remaining,
  onCancel,
  onSubmit,
  onShowFirst,
}: {
  unanswered: number;
  flagged: number;
  remaining: number;
  onCancel: () => void;
  onSubmit: () => void;
  onShowFirst: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="text-xl text-slate-900">
          Nộp bài?
        </h2>
        <p className="mt-2 text-[16px] text-slate-700">
          Còn {formatClock(remaining)}.{' '}
          {unanswered > 0 ? (
            <>
              <b className="font-semibold text-slate-900">{unanswered} câu chưa làm</b> sẽ bị tính sai.
            </>
          ) : (
            'Bạn đã làm hết các câu.'
          )}
          {flagged > 0 && ` ${flagged} câu đang được đánh dấu xem lại.`}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {unanswered > 0 ? (
            <Button variant="secondary" onClick={onShowFirst}>
              Làm tiếp câu chưa làm
            </Button>
          ) : (
            <Button variant="secondary" onClick={onCancel}>
              Xem lại bài
            </Button>
          )}
          <Button onClick={onSubmit}>
            <Send className="h-4 w-4" /> Nộp bài
          </Button>
        </div>
      </div>
    </div>
  );
}
