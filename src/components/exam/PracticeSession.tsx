import { ArrowRight, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { gradeAnswer, isChoice } from '../../lib/grade';
import { useProgress } from '../../lib/progress';
import { celebrate, cx } from '../../lib/ui';
import { QUESTION_TYPE_LABEL, type BankQuestion } from '../../types/exam';
import { Button, Card } from '../common';
import { QuestionView } from './QuestionView';
import { RichText } from './RichText';

interface Props {
  questions: BankQuestion[];
  /** "Luyện tiếp" on the result screen: the parent picks a fresh set */
  onMore?: () => void;
  moreLabel?: string;
  /** shown under the score on the result screen */
  resultNote?: string;
}

/** One question at a time, checked straight away, with the explanation; results feed the mistakes notebook. */
export function PracticeSession({ questions, onMore, moreLabel = 'Luyện tiếp', resultNote }: Props) {
  const { recordQuestion } = useProgress();
  const [list, setList] = useState(questions);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<boolean | null>(null);
  const [wrong, setWrong] = useState<BankQuestion[]>([]);
  const [done, setDone] = useState(false);
  const q = list[idx];

  const restart = (next: BankQuestion[]) => {
    setList(next);
    setIdx(0);
    setAnswers({});
    setChecked(null);
    setWrong([]);
    setDone(false);
  };

  const check = useCallback(
    (value: string | undefined) => {
      if (!q || checked !== null) return;
      const ok = gradeAnswer(q, q.type, value) === true;
      recordQuestion(q.id, ok);
      setChecked(ok);
      if (!ok) setWrong((w) => [...w, q]);
    },
    [q, checked, recordQuestion],
  );

  const next = useCallback(() => {
    if (idx + 1 < list.length) {
      setIdx(idx + 1);
      setChecked(null);
      window.scrollTo({ top: 0 });
      return;
    }
    setDone(true);
    if (wrong.length === 0 && list.length >= 5) celebrate();
  }, [idx, list.length, wrong.length]);

  // a picked option is checked at once; error identification waits for the optional correction
  const instant = q ? isChoice(q, q.type) && q.type !== 'error-id' : false;
  const onAnswer = (key: string, value: string) => {
    if (checked !== null) return;
    setAnswers((a) => ({ ...a, [key]: value }));
    if (instant && key === q.id && value) check(value);
  };

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return;
      if (t.tagName === 'BUTTON' || t.tagName === 'A') return;
      e.preventDefault();
      if (checked !== null) next();
      else if (answers[q?.id ?? '']?.trim()) check(answers[q.id]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, checked, next, check, answers, q]);

  if (done) {
    const right = list.length - wrong.length;
    const pct = list.length ? right / list.length : 0;
    return (
      <Card className="mx-auto max-w-xl p-5 text-center md:p-8">
        <div className={cx('mx-auto flex h-24 w-24 items-center justify-center rounded-full font-display text-3xl font-semibold tabular-nums', pct >= 0.8 ? 'bg-indigo-50 text-indigo-700' : pct >= 0.5 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700')}>
          {right}/{list.length}
        </div>
        <h3 className="mt-3 text-xl text-slate-900">{wrong.length === 0 ? 'Đúng hết' : `Sai ${wrong.length} câu`}</h3>
        <p className="mt-1 text-[15px] text-slate-600">{resultNote ?? (wrong.length ? 'Các câu sai đã vào sổ lỗi sai và sẽ được hỏi lại theo lịch.' : 'Không câu nào phải ôn lại.')}</p>
        {wrong.length > 0 && (
          <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 text-left">
            {wrong.map((w) => (
              <li key={w.id} className="px-3 py-2 text-[15px]">
                <span className="text-[13px] text-slate-500">{QUESTION_TYPE_LABEL[w.type]} · </span>
                <RichText text={w.prompt || (w.options ?? []).join(' · ')} className="text-slate-800" />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && (
            <Button onClick={() => restart(wrong)}>
              <RotateCcw className="h-4 w-4" /> Làm lại câu sai ({wrong.length})
            </Button>
          )}
          {onMore && (
            <Button variant={wrong.length ? 'secondary' : 'primary'} onClick={onMore}>
              {moreLabel}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (!q) return null;
  const value = answers[q.id] ?? '';
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(idx / list.length) * 100}%` }} />
        </div>
        <span className="text-sm font-bold tabular-nums text-slate-500">
          {idx + 1}/{list.length}
        </span>
      </div>
      <Card className="mt-3 p-4 md:p-6">
        <p className="text-[13px] font-medium text-slate-500">{QUESTION_TYPE_LABEL[q.type]}</p>
        <p className="mt-0.5 text-[15px] font-medium text-slate-800">{q.instruction}</p>
        {q.passage && (
          <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50" open>
            <summary className="cursor-pointer select-none px-3 py-2 text-[14px] font-semibold text-slate-700">Đoạn văn</summary>
            <RichText text={q.passage} className="block px-3 pb-3 text-[16px] leading-[1.75] text-slate-900" />
          </details>
        )}
        <QuestionView key={`${q.id}-${checked === null ? 'a' : 'r'}`} q={q} type={q.type} answers={answers} onAnswer={checked === null ? onAnswer : undefined} />
      </Card>
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {checked === null ? (
          <>
            <Button key="skip" variant="ghost" onClick={() => check(value)}>
              Không biết, xem đáp án
            </Button>
            {!instant && (
              <Button key="check" onClick={() => check(value)} disabled={!value.trim()}>
                Kiểm tra
              </Button>
            )}
          </>
        ) : (
          <Button key="next" onClick={next}>
            {idx + 1 < list.length ? 'Câu tiếp' : 'Xem kết quả'} <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 hidden text-right text-[13px] text-slate-400 md:block">Enter: kiểm tra / sang câu tiếp</p>
    </div>
  );
}
