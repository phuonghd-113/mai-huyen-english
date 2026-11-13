import { ArrowRight, CircleCheck, CircleX, Play, RotateCcw, Trophy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, PosTag, Segmented, SpeakButton } from '../components/common';
import { useProgress } from '../lib/progress';
import { buildQuiz, type Direction, type Question } from '../lib/quiz';
import { celebrate, cx, useSpeak } from '../lib/ui';
import type { VocabItem } from '../types/vocab';

type Phase = 'setup' | 'play' | 'result';

export function QuizMode({ words, scope }: { words: VocabItem[]; scope: string }) {
  const { state, recordAnswer, updateScore } = useProgress();
  const speak = useSpeak();
  const [count, setCount] = useState<number>(Math.min(15, words.length));
  const [dir, setDir] = useState<Direction>('en-vi');
  const [phase, setPhase] = useState<Phase>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [wrong, setWrong] = useState<VocabItem[]>([]);
  const [best, setBest] = useState<{ prev?: number; isNew: boolean }>({ isNew: false });

  const start = useCallback(
    (pool: VocabItem[], n: number) => {
      setQuestions(buildQuiz(pool, n, dir));
      setIdx(0);
      setChosen(null);
      setWrong([]);
      setPhase('play');
    },
    [dir],
  );

  const q = questions[idx];

  const choose = useCallback(
    (opt: VocabItem) => {
      if (!q || chosen) return;
      setChosen(opt.id);
      const ok = opt.id === q.word.id;
      recordAnswer(q.word.id, ok);
      if (!ok) setWrong((w) => [...w, q.word]);
      if (state.settings.autoSpeak) speak(q.word.speakText);
    },
    [q, chosen, recordAnswer, state.settings.autoSpeak, speak],
  );

  const next = useCallback(() => {
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      setChosen(null);
      return;
    }
    const total = questions.length;
    const wrongCount = wrong.length;
    const pct = Math.round(((total - wrongCount) / total) * 100);
    const prev = state.scores[scope]?.bestQuiz;
    // Only full-length runs (not "retry wrong answers") count toward the best score.
    const counts = total >= Math.min(15, words.length);
    if (counts) updateScore(scope, (s) => ({ ...s, bestQuiz: Math.max(s.bestQuiz ?? 0, pct) }));
    else updateScore(scope, (s) => s);
    setBest({ prev, isNew: counts && (prev === undefined || pct > prev) });
    if (pct >= 80) celebrate();
    setPhase('result');
  }, [idx, questions.length, wrong.length, state.scores, scope, updateScore, words.length]);

  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const n = Number(e.key);
      if (!chosen && n >= 1 && n <= (q?.options.length ?? 0)) choose(q!.options[n - 1]);
      else if (chosen && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, chosen, q, choose, next]);

  if (phase === 'setup') {
    const counts = [15, 30].filter((c) => c < words.length);
    const best = state.scores[scope]?.bestQuiz;
    return (
      <Card className="mx-auto max-w-xl space-y-5 p-5 md:p-7">
        <div>
          <h3 className="text-lg text-slate-900">Trắc nghiệm phản xạ</h3>
          <p className="text-sm text-slate-500">Chọn nghĩa đúng trong 4 đáp án. Câu sai sẽ được đưa vào mục Ôn tập.</p>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-700">Số câu</div>
          <Segmented<number>
            value={count}
            onChange={setCount}
            className="w-full"
            label="Số câu"
            options={[...counts.map((c) => ({ value: c, label: `${c} câu` })), { value: words.length, label: `Tất cả (${words.length})` }]}
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-700">Chiều hỏi</div>
          <Segmented<Direction>
            value={dir}
            onChange={setDir}
            className="w-full"
            label="Chiều hỏi"
            options={[
              { value: 'en-vi', label: 'Anh → Việt' },
              { value: 'vi-en', label: 'Việt → Anh' },
            ]}
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
    const total = questions.length;
    const right = total - wrong.length;
    const pct = Math.round((right / total) * 100);
    return (
      <Card className="mx-auto max-w-xl p-5 text-center md:p-8">
        <div className={cx('mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl', pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>
          {pct}%
        </div>
        <h3 className="mt-3 text-xl text-slate-900">
          Đúng {right}/{total} câu
        </h3>
        <p className="text-sm text-slate-500">
          {wrong.length === 0 ? 'Không sai câu nào.' : `${wrong.length} câu sai đã vào mục Ôn tập. Lật lại bằng Flashcards rồi làm lại nhé.`}
          {best.isNew && <span className="mt-1 block font-semibold text-slate-900">Điểm cao nhất mới của unit này.</span>}
        </p>
        {wrong.length > 0 && (
          <div className="mt-5 text-left">
            <div className="mb-2 text-sm font-bold text-slate-700">Các câu sai</div>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {wrong.map((w) => (
                <li key={w.id} className="flex items-center gap-2 px-3 py-2">
                  <SpeakButton word={w} size="sm" />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-900">{w.term}</span> <PosTag pos={w.pos} />
                    <div className="text-sm text-slate-600">{w.meaning}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && (
            <Button onClick={() => start(wrong, wrong.length)}>
              <RotateCcw className="h-4 w-4" /> Làm lại câu sai ({wrong.length})
            </Button>
          )}
          <Button variant="secondary" onClick={() => setPhase('setup')}>
            Làm bài mới
          </Button>
        </div>
      </Card>
    );
  }

  if (!q) return null;
  const isEnVi = dir === 'en-vi';
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-260px)] max-w-xl flex-col md:min-h-0">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(idx / questions.length) * 100}%` }} />
        </div>
        <span className="text-sm font-bold tabular-nums text-slate-500">
          {idx + 1}/{questions.length}
        </span>
      </div>
      <Card className="mt-3 p-5 text-center md:p-7">
        <div className="text-[15px] text-slate-600">{isEnVi ? 'Nghĩa của từ này là gì?' : 'Từ tiếng Anh nào có nghĩa là:'}</div>
        {isEnVi ? (
          <>
            <div className="mt-2 font-display text-[34px] font-semibold leading-tight text-slate-900">{q.word.term}</div>
            <div className="mt-1 flex items-center justify-center gap-2">
              <PosTag pos={q.word.pos} />
              {q.word.ipa && <span className="font-mono text-sm text-slate-500">{q.word.ipa}</span>}
              <SpeakButton word={q.word} size="sm" />
            </div>
          </>
        ) : (
          <>
            <div className="mt-2 text-2xl font-bold text-slate-900">{q.word.meaning}</div>
            {q.word.pos && (
              <div className="mt-1">
                <PosTag pos={q.word.pos} />
              </div>
            )}
          </>
        )}
      </Card>
      <div className="mt-3 grid gap-2">
        {q.options.map((o, i) => {
          const isRight = o.id === q.word.id;
          const isChosen = o.id === chosen;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o)}
              disabled={!!chosen}
              className={cx(
                'flex min-h-[56px] items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left text-[15px] font-semibold transition',
                !chosen && 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 active:scale-[0.99]',
                chosen && isRight && 'animate-pop border-emerald-500 bg-emerald-50 text-emerald-800',
                chosen && isChosen && !isRight && 'animate-shake border-red-400 bg-red-50 text-red-700',
                chosen && !isRight && !isChosen && 'border-slate-100 text-slate-400',
              )}
            >
              <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold', chosen && isRight ? 'bg-emerald-600 text-white' : chosen && isChosen ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500')}>
                {chosen && isRight ? <CircleCheck className="h-4 w-4" /> : chosen && isChosen ? <CircleX className="h-4 w-4" /> : i + 1}
              </span>
              <span className="flex-1">{isEnVi ? o.meaning : o.term}</span>
            </button>
          );
        })}
      </div>
      {chosen && (
        <div className="mt-3 space-y-2">
          {!isEnVi && (
            <p className="text-center text-sm text-slate-500">
              <b className="text-slate-800">{q.word.term}</b> {q.word.ipa}
            </p>
          )}
          <Button onClick={next} className="w-full">
            {idx + 1 < questions.length ? 'Câu tiếp' : 'Xem kết quả'} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      <p className="mt-3 hidden text-center text-[13px] text-slate-400 md:block">Phím tắt: 1–4 chọn đáp án · Enter sang câu tiếp</p>
    </div>
  );
}
