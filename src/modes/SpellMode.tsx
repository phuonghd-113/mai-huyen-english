import { ArrowRight, Lightbulb, Play, RotateCcw, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, CategoryBadge, PosTag, Segmented, SpeakButton } from '../components/common';
import { useProgress } from '../lib/progress';
import { canonicalAnswer, isCorrectAnswer, shuffle } from '../lib/text';
import { celebrate, cx, useSpeak } from '../lib/ui';
import type { VocabItem } from '../types/vocab';

type Phase = 'setup' | 'play' | 'result';
type QState = 'answering' | 'retry' | 'correct' | 'revealed';

function mask(answer: string, shown: number) {
  let letters = 0;
  return answer
    .split('')
    .map((ch) => {
      if (!/[a-z]/i.test(ch)) return ch;
      letters++;
      return letters <= shown ? ch : '_';
    })
    .join('');
}

export function SpellMode({ words, scope }: { words: VocabItem[]; scope: string }) {
  const { state, recordAnswer, updateScore } = useProgress();
  const speak = useSpeak();
  const [count, setCount] = useState(Math.min(10, words.length));
  const [phase, setPhase] = useState<Phase>('setup');
  const [list, setList] = useState<VocabItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [qs, setQs] = useState<QState>('answering');
  const [hints, setHints] = useState(0);
  const [missed, setMissed] = useState<VocabItem[]>([]);
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const w = list[idx];
  const answer = w ? canonicalAnswer(w.term) : '';
  const letterCount = answer.replace(/[^a-z]/gi, '').length;

  const start = (pool: VocabItem[], n: number) => {
    setList(shuffle(pool).slice(0, n));
    setIdx(0);
    setMissed([]);
    resetQ();
    setPhase('play');
  };
  const resetQ = () => {
    setInput('');
    setQs('answering');
    setHints(0);
  };

  useEffect(() => {
    if (phase !== 'play') return;
    inputRef.current?.focus();
  }, [phase, idx, qs]);

  const finishWord = (ok: boolean) => {
    if (state.settings.autoSpeak) speak(w.speakText);
    if (!ok) setMissed((m) => (m.some((x) => x.id === w.id) ? m : [...m, w]));
  };

  const check = () => {
    if (!w || !input.trim()) return;
    if (isCorrectAnswer(input, w.term)) {
      const firstTry = qs === 'answering' && hints === 0;
      recordAnswer(w.id, firstTry);
      setQs('correct');
      finishWord(firstTry);
    } else if (qs === 'answering') {
      setQs('retry');
      setShake((s) => s + 1);
    } else {
      recordAnswer(w.id, false);
      setQs('revealed');
      finishWord(false);
    }
  };

  const reveal = () => {
    recordAnswer(w.id, false);
    setQs('revealed');
    finishWord(false);
  };

  const next = () => {
    if (idx + 1 < list.length) {
      setIdx(idx + 1);
      resetQ();
      return;
    }
    const pct = Math.round(((list.length - missed.length) / list.length) * 100);
    if (list.length >= Math.min(10, words.length)) updateScore(scope, (s) => ({ ...s, bestSpell: Math.max(s.bestSpell ?? 0, pct) }));
    if (pct >= 80) celebrate();
    setPhase('result');
  };

  if (phase === 'setup') {
    const opts = [10, 20].filter((c) => c < words.length);
    const best = state.scores[scope]?.bestSpell;
    return (
      <Card className="mx-auto max-w-xl space-y-5 p-5 md:p-7">
        <div>
          <h3 className="text-lg text-slate-900">Luyện gõ từ</h3>
          <p className="text-sm text-slate-500">
            Xem nghĩa tiếng Việt và phiên âm, gõ lại từ tiếng Anh. Không cần gõ hoa, có thể bỏ <i>sb/ sth</i>; phần trong ngoặc là tùy chọn; với dạng <i>a/ b</i> gõ một trong hai.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-700">Số từ</div>
          <Segmented<number>
            value={count}
            onChange={setCount}
            className="w-full"
            label="Số từ"
            options={[...opts.map((c) => ({ value: c, label: `${c} từ` })), { value: words.length, label: `Tất cả (${words.length})` }]}
          />
        </div>
        <Button onClick={() => start(words, count)} className="w-full">
          <Play className="h-4 w-4" /> Bắt đầu
        </Button>
        {best !== undefined && (
          <p className="flex items-center justify-center gap-1.5 text-[15px] text-slate-600">
            <Trophy className="h-4 w-4" /> Điểm cao nhất: {best}%
          </p>
        )}
      </Card>
    );
  }

  if (phase === 'result') {
    const right = list.length - missed.length;
    const pct = Math.round((right / list.length) * 100);
    return (
      <Card className="mx-auto max-w-xl p-5 text-center md:p-8">
        <div className={cx('mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl', pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>
          {pct}%
        </div>
        <h3 className="mt-3 text-xl text-slate-900">
          Gõ đúng ngay lần đầu {right}/{list.length} từ
        </h3>
        {missed.length > 0 && (
          <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 text-left">
            {missed.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                <SpeakButton word={m} size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-900">{m.term}</span>
                  <div className="text-sm text-slate-600">{m.meaning}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {missed.length > 0 && (
            <Button onClick={() => start(missed, missed.length)}>
              <RotateCcw className="h-4 w-4" /> Luyện lại từ sai ({missed.length})
            </Button>
          )}
          <Button variant="secondary" onClick={() => setPhase('setup')}>
            Lượt mới
          </Button>
        </div>
      </Card>
    );
  }

  if (!w) return null;
  const finished = qs === 'correct' || qs === 'revealed';
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(idx / list.length) * 100}%` }} />
        </div>
        <span className="text-sm font-bold tabular-nums text-slate-500">
          {idx + 1}/{list.length}
        </span>
      </div>

      <Card className="p-5 text-center md:p-7">
        <div className="flex items-center justify-center gap-2">
          <CategoryBadge category={w.category} />
          <PosTag pos={w.pos} />
        </div>
        <div className="mt-3 text-2xl font-bold leading-snug text-slate-900">{w.meaning}</div>
        {w.note && <div className="mt-1 text-sm text-slate-500">{w.note}</div>}
        <div className="mt-3 flex items-center justify-center gap-2">
          {w.ipa && <span className="font-mono text-base text-slate-500">{w.ipa}</span>}
          <SpeakButton word={w} className="bg-indigo-50" />
        </div>
        {hints > 0 && !finished && <div className="mt-3 font-mono text-lg tracking-[0.2em] text-indigo-600">{mask(answer, hints)}</div>}
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (finished) next();
          else check();
        }}
        className="space-y-2"
      >
        <input
          key={`${idx}-${shake}`}
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          readOnly={finished}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && finished) {
              e.preventDefault();
              next();
            }
          }}
          placeholder="Gõ từ tiếng Anh…"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="Câu trả lời"
          className={cx(
            'h-14 w-full rounded-2xl border-2 bg-white px-4 text-center text-xl font-semibold outline-none transition',
            qs === 'correct' && 'border-emerald-500 bg-emerald-50 text-emerald-800',
            qs === 'revealed' && 'border-red-300 bg-red-50 text-red-700 line-through',
            qs === 'retry' && 'animate-shake border-orange-400',
            qs === 'answering' && 'border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100',
          )}
        />
        {qs === 'retry' && <p className="text-center text-sm font-semibold text-orange-600">Chưa đúng. Bạn còn một lần thử.</p>}
        {qs === 'correct' && <p className="text-center text-sm font-semibold text-emerald-600">Chính xác! {w.term !== input.trim() && <span className="font-normal text-slate-500">({w.term})</span>}</p>}
        {qs === 'revealed' && (
          <p className="text-center text-sm text-slate-600">
            Đáp án: <b className="text-lg text-slate-900">{w.term}</b>
          </p>
        )}

        {finished ? (
          <Button type="submit" className="w-full">
            {idx + 1 < list.length ? 'Từ tiếp theo' : 'Xem kết quả'} <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
            <Button variant="secondary" onClick={() => setHints((h) => Math.min(letterCount, h + 1))} disabled={hints >= letterCount}>
              <Lightbulb className="h-4 w-4" /> Gợi ý
            </Button>
            <Button variant="ghost" onClick={reveal}>
              Bỏ qua
            </Button>
            <Button type="submit" disabled={!input.trim()}>
              Kiểm tra
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
