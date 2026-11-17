import { ArrowLeft, Flame, LoaderCircle, NotebookPen, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, ProgressBar, Segmented } from '../components/common';
import { PracticeSession } from '../components/exam/PracticeSession';
import { MobileHeader } from '../components/Layout';
import { ALL_WORDS } from '../data';
import { useBank } from '../lib/exam-ui';
import { dueQuestions, pickPractice, queuedQuestions, typeStats, type TypeStats } from '../lib/practice';
import { isHard, useProgress } from '../lib/progress';
import { href } from '../lib/router';
import { QUESTION_TYPE_LABEL, QUESTION_TYPES, type BankQuestion, type QuestionType } from '../types/exam';

export function PracticePage({ type }: { type?: QuestionType }) {
  const bank = useBank();
  return (
    <>
      <MobileHeader title={type ? QUESTION_TYPE_LABEL[type] : 'Luyện tập'} back={type ? href.practice() : undefined} />
      <main className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6 md:px-8 md:pt-12">
        {bank.status === 'loading' && (
          <div className="flex justify-center p-10 text-slate-400">
            <LoaderCircle className="h-8 w-8 animate-spin" aria-label="Đang tải câu hỏi" />
          </div>
        )}
        {bank.status === 'error' && <EmptyState icon={<NotebookPen className="h-12 w-12" />} title="Không tải được câu hỏi">Kiểm tra kết nối mạng rồi tải lại trang.</EmptyState>}
        {bank.status === 'ready' && (type ? <TypePractice key={type} type={type} bank={bank.data} /> : <Hub bank={bank.data} />)}
      </main>
    </>
  );
}

function Hub({ bank }: { bank: BankQuestion[] }) {
  const { state } = useProgress();
  const stats = useMemo(() => {
    const by = new Map(typeStats(bank, state.questions).map((s) => [s.type, s]));
    return QUESTION_TYPES.map((t) => by.get(t)).filter((s): s is TypeStats => !!s);
  }, [bank, state.questions]);
  const { queued, due } = useMemo(
    () => ({ queued: queuedQuestions(bank, state.questions).length, due: dueQuestions(bank, state.questions, Date.now()).length }),
    [bank, state.questions],
  );
  const hardWords = useMemo(() => ALL_WORDS.filter((w) => isHard(state.words[w.id])).length, [state.words]);

  return (
    <>
      <h1 className="text-[32px] leading-tight text-slate-900 md:text-[44px]">Luyện tập</h1>
      <p className="mt-2 max-w-2xl text-[16px] text-slate-600">Luyện từng dạng bài với câu hỏi lấy từ các đề. Mỗi câu chấm ngay và có giải thích; câu sai được hỏi lại sau 1, 3, 7, 14 và 30 ngày.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a href={href.mistakes()} className="lift flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <NotebookPen className="h-7 w-7 shrink-0 text-indigo-600" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[18px] font-semibold text-slate-900">Sổ lỗi sai</span>
            <span className="block text-[15px] text-slate-600">{queued === 0 ? 'Chưa có câu nào' : due > 0 ? `${due} câu đến hạn ôn hôm nay` : `${queued} câu, chưa đến hạn ôn`}</span>
          </span>
          {due > 0 && <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[14px] font-semibold tabular-nums text-orange-800">{due}</span>}
        </a>
        <a href={href.review('flashcards')} className="lift flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <Flame className="h-7 w-7 shrink-0 text-indigo-600" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[18px] font-semibold text-slate-900">Ôn từ vựng khó</span>
            <span className="block text-[15px] text-slate-600">{hardWords ? `${hardWords} từ gắn sao, đang học hoặc hay sai` : 'Chưa có từ khó'}</span>
          </span>
        </a>
      </div>

      <div className="mt-10 flex items-baseline justify-between gap-3">
        <h2 className="text-2xl text-slate-900">Theo dạng bài</h2>
        <a href={href.stats()} className="text-[15px] font-semibold text-indigo-700">
          Xem thống kê
        </a>
      </div>
      {stats.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<NotebookPen className="h-12 w-12" />} title="Chưa có câu hỏi">
            Câu hỏi luyện tập lấy từ các đề đã nhập.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => {
            const answered = s.right + s.wrong;
            return (
              <a key={s.type} href={href.practice(s.type)} className="lift block rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-[18px] font-semibold text-slate-900">{QUESTION_TYPE_LABEL[s.type]}</span>
                  <span className="text-[14px] tabular-nums text-slate-500">{s.total} câu</span>
                </div>
                <ProgressBar value={s.seen / s.total} className="mt-3 h-1.5" />
                <p className="mt-2 text-[14px] text-slate-600">
                  {answered ? (
                    <>
                      Đã làm {s.seen}/{s.total} · đúng <b className="font-semibold tabular-nums text-slate-900">{Math.round((s.right / answered) * 100)}%</b>
                    </>
                  ) : (
                    'Chưa làm câu nào'
                  )}
                </p>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}

function TypePractice({ type, bank }: { type: QuestionType; bank: BankQuestion[] }) {
  const { state } = useProgress();
  const total = useMemo(() => typeStats(bank, state.questions).find((s) => s.type === type)?.total ?? 0, [bank, state.questions, type]);
  const [count, setCount] = useState(10);
  const [session, setSession] = useState<{ n: number; questions: BankQuestion[] } | null>(null);
  const start = () => setSession((s) => ({ n: (s?.n ?? 0) + 1, questions: pickPractice(bank, state.questions, type, count) }));

  if (session) {
    return (
      <>
        <BackLink />
        <h1 className="mb-4 mt-2 hidden text-[28px] text-slate-900 md:block">{QUESTION_TYPE_LABEL[type]}</h1>
        <PracticeSession key={session.n} questions={session.questions} onMore={start} moreLabel={`Luyện tiếp ${Math.min(count, total)} câu`} />
      </>
    );
  }

  return (
    <>
      <BackLink />
      <h1 className="mt-2 text-[28px] leading-tight text-slate-900 md:text-[36px]">{QUESTION_TYPE_LABEL[type]}</h1>
      {total === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<NotebookPen className="h-12 w-12" />} title="Dạng này chưa có câu hỏi có đáp án" />
        </div>
      ) : (
        <Card className="mt-6 max-w-xl space-y-5 p-5 md:p-7">
          <p className="text-[15px] text-slate-600">Có {total} câu. App ưu tiên câu bạn chưa làm, rồi đến câu hay sai.</p>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">Số câu</div>
            <Segmented<number>
              value={Math.min(count, total)}
              onChange={setCount}
              className="w-full"
              label="Số câu"
              options={[...[10, 20].filter((c) => c < total).map((c) => ({ value: c, label: `${c} câu` })), { value: total, label: `Tất cả (${total})` }]}
            />
          </div>
          <Button onClick={start} className="w-full">
            <Play className="h-4 w-4" /> Bắt đầu
          </Button>
        </Card>
      )}
    </>
  );
}

function BackLink() {
  return (
    <a href={href.practice()} className="hidden items-center gap-1.5 text-[15px] text-slate-600 hover:text-slate-900 md:inline-flex">
      <ArrowLeft className="h-4 w-4" /> Luyện tập
    </a>
  );
}

