import { ArrowLeft, LoaderCircle, NotebookPen, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Card, EmptyState } from '../components/common';
import { PracticeSession } from '../components/exam/PracticeSession';
import { RichText } from '../components/exam/RichText';
import { MobileHeader } from '../components/Layout';
import { useBank } from '../lib/exam-ui';
import { queuedQuestions } from '../lib/practice';
import { useProgress } from '../lib/progress';
import { href } from '../lib/router';
import { SRS_DAYS } from '../lib/srs';
import { cx } from '../lib/ui';
import { QUESTION_TYPE_LABEL, type BankQuestion, type QuestionProgress } from '../types/exam';

const MAX_SESSION = 30;

export function MistakesPage() {
  const bank = useBank();
  return (
    <>
      <MobileHeader title="Sổ lỗi sai" back={href.practice()} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6 md:px-8 md:pt-12">
        <a href={href.practice()} className="hidden items-center gap-1.5 text-[15px] text-slate-600 hover:text-slate-900 md:inline-flex">
          <ArrowLeft className="h-4 w-4" /> Luyện tập
        </a>
        {bank.status === 'loading' && (
          <div className="flex justify-center p-10 text-slate-400">
            <LoaderCircle className="h-8 w-8 animate-spin" aria-label="Đang tải câu hỏi" />
          </div>
        )}
        {bank.status === 'error' && <EmptyState icon={<NotebookPen className="h-12 w-12" />} title="Không tải được câu hỏi">Kiểm tra kết nối mạng rồi tải lại trang.</EmptyState>}
        {bank.status === 'ready' && <Notebook bank={bank.data} />}
      </main>
    </>
  );
}

function Notebook({ bank }: { bank: BankQuestion[] }) {
  const { state } = useProgress();
  const [session, setSession] = useState<{ n: number; questions: BankQuestion[] } | null>(null);
  // "now" for what is due: taken again whenever a session starts or ends
  const now = useMemo(() => Date.now(), [session]);
  const queued = useMemo(() => queuedQuestions(bank, state.questions), [bank, state.questions]);
  const due = queued.filter((q) => state.questions[q.id]!.srs!.due <= now);
  const start = (from: BankQuestion[]) => setSession((s) => ({ n: (s?.n ?? 0) + 1, questions: from.slice(0, MAX_SESSION) }));

  if (session) {
    return (
      <>
        <h1 className="mb-4 mt-2 text-[28px] leading-tight text-slate-900">Ôn lỗi sai</h1>
        <PracticeSession
          key={session.n}
          questions={session.questions}
          resultNote="Câu đúng được hẹn ôn lại xa hơn; câu sai quay về ôn lại sau 1 ngày."
          onMore={() => setSession(null)}
          moreLabel="Về sổ lỗi sai"
        />
      </>
    );
  }

  return (
    <>
      <h1 className="mt-2 text-[32px] leading-tight text-slate-900 md:text-[40px]">Sổ lỗi sai</h1>
      <p className="mt-2 text-[16px] text-slate-600">
        Câu làm sai trong thi thử hoặc luyện tập được ghi ở đây. Làm đúng thì lần ôn sau giãn ra ({SRS_DAYS.join(', ')} ngày); đúng đủ {SRS_DAYS.length} lần liên tiếp thì câu ra khỏi sổ.
      </p>

      {queued.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<NotebookPen className="h-12 w-12" />} title="Sổ đang trống">
            Chưa có câu nào cần ôn.{' '}
            <a className="font-semibold text-indigo-600" href={href.practice()}>
              Luyện tập
            </a>{' '}
            hoặc{' '}
            <a className="font-semibold text-indigo-600" href={href.exams()}>
              làm một đề
            </a>
            .
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {due.length > 0 ? (
              <Button onClick={() => start(due)} className="min-h-[48px] px-6 text-base">
                <Play className="h-4 w-4" /> Ôn {Math.min(due.length, MAX_SESSION)} câu đến hạn
              </Button>
            ) : (
              <p className="self-center text-[16px] text-slate-700">Hôm nay không có câu nào đến hạn.</p>
            )}
            {queued.length > due.length && (
              <Button variant="secondary" onClick={() => start(queued)} className="min-h-[48px] px-6 text-base">
                Ôn trước {Math.min(queued.length, MAX_SESSION)} câu
              </Button>
            )}
          </div>

          <h2 className="mt-10 text-xl text-slate-900">{queued.length} câu trong sổ</h2>
          <Card className="mt-3 divide-y divide-slate-100">
            {queued.map((q) => (
              <Row key={q.id} q={q} p={state.questions[q.id]!} now={now} />
            ))}
          </Card>
        </>
      )}
    </>
  );
}

function Row({ q, p, now }: { q: BankQuestion; p: QuestionProgress; now: number }) {
  const due = p.srs!.due;
  const isDue = due <= now;
  const when = isDue ? 'Đến hạn' : new Date(due).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-slate-500">
          {QUESTION_TYPE_LABEL[q.type]} · sai {p.wrong ?? 0} lần
        </div>
        <RichText text={q.prompt || (q.options ?? []).join(' · ')} className="line-clamp-2 text-[15px] text-slate-800" />
      </div>
      <div className="shrink-0 text-right">
        <div className={cx('text-[14px] font-semibold tabular-nums', isDue ? 'text-orange-700' : 'text-slate-600')}>{when}</div>
        <div className="mt-1 flex justify-end gap-1" aria-label={`Bước ${p.srs!.step + 1}/${SRS_DAYS.length}`}>
          {SRS_DAYS.map((_, i) => (
            <span key={i} className={cx('h-1.5 w-3 rounded-full', i <= p.srs!.step ? 'bg-indigo-500' : 'bg-slate-200')} />
          ))}
        </div>
      </div>
    </div>
  );
}
