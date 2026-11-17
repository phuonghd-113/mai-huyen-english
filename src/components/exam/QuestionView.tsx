import { CircleCheck, CircleX, Flag } from 'lucide-react';
import { countWords, fixKey } from '../../lib/exam-ui';
import { gradeAnswer, isChoice, LETTERS, normalizeChoice, textMatches } from '../../lib/grade';
import { cx } from '../../lib/ui';
import type { Question, QuestionType } from '../../types/exam';
import { RichText } from './RichText';

interface Props {
  q: Question;
  type: QuestionType;
  number: number;
  answers: Record<string, string>;
  /** absent in review */
  onAnswer?: (key: string, value: string) => void;
  flagged?: boolean;
  onFlag?: () => void;
}

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 text-[17px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-100 disabled:bg-slate-50';

/** Typing aids would quietly fix spelling, which is exactly what is being tested. */
const noAssist = { autoCapitalize: 'off', autoCorrect: 'off', autoComplete: 'off', spellCheck: false } as const;

export function QuestionView({ q, type, number, answers, onAnswer, flagged, onFlag }: Props) {
  const review = !onAnswer;
  const value = answers[q.id] ?? '';
  const result = review ? gradeAnswer(q, type, value) : null;
  const choice = isChoice(q, type);

  return (
    <div id={`q-${q.id}`} className="scroll-mt-28 py-4">
      <div className="flex items-start gap-2">
        <div className="flex w-8 shrink-0 flex-col items-start gap-1">
          <span className="mt-0.5 font-display text-[17px] font-semibold tabular-nums text-slate-500">{number}.</span>
          {onFlag && (
            <button
              type="button"
              onClick={onFlag}
              aria-pressed={flagged}
              aria-label={flagged ? 'Bỏ đánh dấu xem lại' : 'Đánh dấu để xem lại'}
              title="Đánh dấu để xem lại"
              className={cx('-ml-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors', flagged ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600')}
            >
              <Flag className="h-[18px] w-[18px]" fill={flagged ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {q.prompt && <RichText text={q.prompt} letterParts={type === 'error-id'} className="block text-[17px] leading-relaxed text-slate-900" />}
          <div className={cx(q.prompt && 'mt-3')}>
            {choice ? (
              <Choices q={q} type={type} value={value} onAnswer={onAnswer} />
            ) : type === 'writing' ? (
              <Writing value={value} onChange={onAnswer && ((v) => onAnswer(q.id, v))} />
            ) : (
              <Typed q={q} type={type} value={value} onChange={onAnswer && ((v) => onAnswer(q.id, v))} result={result} />
            )}
            {type === 'error-id' && <ErrorFix q={q} answers={answers} onAnswer={onAnswer} />}
          </div>
          {review && <ReviewNote q={q} type={type} value={value} result={result} choice={choice} />}
        </div>
      </div>
    </div>
  );
}

function Choices({ q, type, value, onAnswer }: { q: Question; type: QuestionType; value: string; onAnswer?: Props['onAnswer'] }) {
  const options = q.options ?? [];
  const review = !onAnswer;
  const picked = value ? normalizeChoice(value) : '';
  const right = new Set(q.answers.map(normalizeChoice));
  // As many columns as fit the container (not the screen: a reading section is half as wide), never splitting a word.
  const longest = Math.max(0, ...options.map((o) => o.replace(/<\/?u>/g, '').length));
  const minCol = longest > 22 ? 280 : Math.max(120, 64 + longest * 10);
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minCol}px), 1fr))` }}
      role={review ? undefined : 'radiogroup'}
    >
      {options.map((o, i) => {
        const letter = LETTERS[i];
        const isPicked = picked === letter;
        const isRight = right.has(letter);
        const showRight = review && isRight && right.size > 0;
        const showWrong = review && isPicked && !isRight && right.size > 0;
        return (
          <button
            key={letter}
            type="button"
            role={review ? undefined : 'radio'}
            aria-checked={review ? undefined : isPicked}
            disabled={review}
            onClick={() => onAnswer?.(q.id, isPicked ? '' : letter)}
            className={cx(
              'flex min-h-[48px] items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-[16px] transition-colors',
              !review && !isPicked && 'border-slate-200 bg-white hover:border-indigo-300',
              !review && isPicked && 'border-indigo-600 bg-indigo-50 text-slate-900',
              review && showRight && 'border-emerald-500 bg-emerald-50 text-emerald-900',
              review && showWrong && 'border-red-400 bg-red-50 text-red-800',
              review && !showRight && !showWrong && (isPicked ? 'border-slate-400 bg-white' : 'border-slate-100 bg-white text-slate-500'),
            )}
          >
            <span
              className={cx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold',
                showRight ? 'bg-emerald-600 text-white' : showWrong ? 'bg-red-600 text-white' : isPicked ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600',
              )}
            >
              {letter}
            </span>
            <RichText text={o} className="min-w-0 break-words" />
          </button>
        );
      })}
    </div>
  );
}

function Typed({ q, type, value, onChange, result }: { q: Question; type: QuestionType; value: string; onChange?: (v: string) => void; result: boolean | null }) {
  const long = type === 'transform' || type === 'reading' || type === 'other';
  const tone = result === true ? 'border-emerald-500 bg-emerald-50' : result === false ? 'border-red-400 bg-red-50' : '';
  const field = long ? (
    <textarea
      {...noAssist}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={!onChange}
      rows={2}
      placeholder={onChange ? 'Viết câu trả lời' : 'Không trả lời'}
      className={cx(inputCls, 'resize-y py-2.5 leading-relaxed', tone)}
    />
  ) : (
    <input
      {...noAssist}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={!onChange}
      placeholder={onChange ? 'Đáp án' : 'Không trả lời'}
      className={cx(inputCls, 'h-12 md:max-w-sm', tone)}
      enterKeyHint="next"
    />
  );
  if (type === 'transform' && q.lead) {
    return (
      <div>
        <div className="mb-1.5 text-[15px] text-slate-600">
          Bắt đầu bằng: <b className="font-semibold text-slate-900">{q.lead}</b> …
        </div>
        {field}
      </div>
    );
  }
  return field;
}

function Writing({ value, onChange }: { value: string; onChange?: (v: string) => void }) {
  return (
    <div>
      <textarea
        {...noAssist}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={!onChange}
        rows={10}
        placeholder={onChange ? 'Viết bài ở đây' : 'Không viết bài'}
        className={cx(inputCls, 'resize-y py-3 leading-relaxed')}
      />
      <div className="mt-1 text-right text-[13px] tabular-nums text-slate-500">{countWords(value)} từ</div>
    </div>
  );
}

function ErrorFix({ q, answers, onAnswer }: { q: Question; answers: Record<string, string>; onAnswer?: Props['onAnswer'] }) {
  const key = fixKey(q.id);
  const value = answers[key] ?? '';
  const review = !onAnswer;
  if (review && !value && !q.fix?.length) return null;
  const ok = review && q.fix?.length && value ? textMatches(value, q.fix) : null;
  return (
    <label className="mt-2 flex items-center gap-2">
      <span className="shrink-0 text-[15px] text-slate-600">Sửa thành</span>
      <input
        {...noAssist}
        value={value}
        onChange={(e) => onAnswer?.(key, e.target.value)}
        readOnly={review}
        placeholder={review ? 'Không sửa' : 'Không bắt buộc'}
        className={cx(inputCls, 'h-11 max-w-xs text-[16px]', ok === true && 'border-emerald-500 bg-emerald-50', ok === false && 'border-red-400 bg-red-50')}
      />
    </label>
  );
}

function ReviewNote({ q, type, value, result, choice }: { q: Question; type: QuestionType; value: string; result: boolean | null; choice: boolean }) {
  const shown = (s: string) => s.replace(/<\/?u>/g, '');
  return (
    <div className="mt-2 space-y-1.5 text-[15px]">
      {result === true && (
        <p className="flex items-center gap-1.5 font-semibold text-emerald-700">
          <CircleCheck className="h-4 w-4" /> Đúng
        </p>
      )}
      {result === false && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-red-700">
          <CircleX className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{value.trim() ? 'Sai.' : 'Chưa làm.'}</span>
          {!choice && (
            <span className="text-slate-700">
              Đáp án: <b className="font-semibold text-slate-900">{q.answers.map(shown).join(' / ')}</b>
            </span>
          )}
        </p>
      )}
      {result === null && type !== 'writing' && <p className="text-slate-500">Đề chưa có đáp án cho câu này, nên không tính điểm.</p>}
      {type === 'error-id' && !!q.fix?.length && (
        <p className="text-slate-700">
          Cách sửa: <b className="font-semibold text-slate-900">{q.fix.join(' / ')}</b>
        </p>
      )}
      {q.explanation && <p className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">{q.explanation}</p>}
      {type === 'writing' && q.sample && (
        <details className="rounded-xl border border-slate-200 bg-white" open>
          <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-slate-800">Bài mẫu ({countWords(q.sample)} từ)</summary>
          <p className="whitespace-pre-line px-3 pb-3 leading-relaxed text-slate-700">{q.sample}</p>
        </details>
      )}
    </div>
  );
}
