import { Play, Timer, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, EmptyState } from '../components/common';
import { useProgress } from '../lib/progress';
import { formatMs, normalizeAnswer, shuffle } from '../lib/text';
import { celebrate, cx, useSpeak } from '../lib/ui';
import type { VocabItem } from '../types/vocab';

const PAIRS = 6;

interface Tile {
  key: string;
  wordId: string;
  kind: 'term' | 'meaning';
  text: string;
}

function pickRound(words: VocabItem[]): VocabItem[] {
  const out: VocabItem[] = [];
  const terms = new Set<string>();
  const meanings = new Set<string>();
  for (const w of shuffle(words)) {
    const t = normalizeAnswer(w.term);
    const m = normalizeAnswer(w.meaning);
    if (terms.has(t) || meanings.has(m)) continue;
    terms.add(t);
    meanings.add(m);
    out.push(w);
    if (out.length === PAIRS) break;
  }
  return out;
}

export function MatchMode({ words, scope }: { words: VocabItem[]; scope: string }) {
  const { state, updateScore } = useProgress();
  const speak = useSpeak();
  const [round, setRound] = useState(0);
  const roundWords = useMemo(() => pickRound(words), [words, round]);
  const tiles = useMemo<Tile[]>(
    () =>
      shuffle(
        roundWords.flatMap((w) => [
          { key: `${w.id}-t`, wordId: w.id, kind: 'term' as const, text: w.term },
          { key: `${w.id}-m`, wordId: w.id, kind: 'meaning' as const, text: w.meaning },
        ]),
      ),
    [roundWords],
  );
  const [selected, setSelected] = useState<Tile | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [bad, setBad] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finishMs, setFinishMs] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  const badTimer = useRef<number>();

  const best = state.scores[scope]?.bestMatchMs;
  const done = finishMs !== null;

  useEffect(() => {
    setSelected(null);
    setMatched(new Set());
    setBad([]);
    setMistakes(0);
    setStartAt(null);
    setFinishMs(null);
    setRecord(false);
  }, [tiles]);

  useEffect(() => {
    if (startAt === null || done) return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [startAt, done]);

  useEffect(() => () => window.clearTimeout(badTimer.current), []);

  if (roundWords.length < 2) {
    return (
      <EmptyState icon={<Timer className="h-12 w-12" />} title="Chưa đủ từ để ghép">
        Cần ít nhất 2 từ có nghĩa khác nhau.
      </EmptyState>
    );
  }

  const click = (tile: Tile) => {
    if (done || matched.has(tile.wordId) || bad.length) return;
    if (startAt === null) {
      setStartAt(Date.now());
      setNow(Date.now());
    }
    if (tile.kind === 'term') speak(roundWords.find((w) => w.id === tile.wordId)!.speakText);
    if (!selected) {
      setSelected(tile);
      return;
    }
    if (selected.key === tile.key) {
      setSelected(null);
      return;
    }
    if (selected.kind === tile.kind) {
      setSelected(tile);
      return;
    }
    if (selected.wordId === tile.wordId) {
      const next = new Set(matched).add(tile.wordId);
      setMatched(next);
      setSelected(null);
      if (next.size === roundWords.length) {
        const ms = Date.now() - (startAt ?? Date.now());
        setFinishMs(ms);
        if (roundWords.length === PAIRS) {
          const isRecord = best === undefined || ms < best;
          setRecord(isRecord);
          updateScore(scope, (s) => ({ ...s, bestMatchMs: Math.min(s.bestMatchMs ?? Infinity, ms) }));
        }
        celebrate();
      }
    } else {
      setBad([selected.key, tile.key]);
      setMistakes((m) => m + 1);
      setSelected(null);
      badTimer.current = window.setTimeout(() => setBad([]), 550);
    }
  };

  const elapsed = done ? finishMs! : startAt ? now - startAt : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 tabular-nums ring-1 ring-slate-200">
            <Timer className="h-4 w-4 text-indigo-500" /> {formatMs(elapsed)}
          </span>
          <span className="text-slate-400">
            {matched.size}/{roundWords.length} cặp · {mistakes} lỗi
          </span>
        </div>
        {best !== undefined && (
          <span className="inline-flex items-center gap-1 text-[15px] text-slate-600">
            <Trophy className="h-4 w-4" /> {formatMs(best)}
          </span>
        )}
      </div>

      {done ? (
        <Card className="p-6 text-center md:p-8">
          <Trophy className="mx-auto h-12 w-12 text-amber-500" />
          <h3 className="mt-2 text-xl text-slate-900">Hoàn thành trong {formatMs(finishMs!)}</h3>
          <p className="text-sm text-slate-500">
            {mistakes === 0 ? 'Không ghép sai lần nào.' : `${mistakes} lần ghép sai`}
            {record && <span className="mt-1 block font-semibold text-slate-900">Nhanh nhất từ trước tới giờ.</span>}
          </p>
          <Button onClick={() => setRound((r) => r + 1)} className="mt-4">
            <Play className="h-4 w-4" /> Chơi lượt mới
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {tiles.map((t) => {
              const isMatched = matched.has(t.wordId);
              const isSel = selected?.key === t.key;
              const isBad = bad.includes(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => click(t)}
                  disabled={isMatched}
                  className={cx(
                    'flex min-h-[84px] items-center justify-center rounded-2xl border-2 px-2 py-3 text-center text-sm leading-snug transition duration-200 md:min-h-[100px] md:text-[15px]',
                    t.kind === 'term' ? 'font-bold text-slate-900' : 'font-medium text-slate-700',
                    isMatched && 'scale-90 border-transparent bg-emerald-50 opacity-0',
                    !isMatched && !isSel && !isBad && (t.kind === 'term' ? 'border-indigo-100 bg-white hover:border-indigo-300' : 'border-slate-200 bg-slate-50 hover:border-slate-300'),
                    isSel && 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100',
                    isBad && 'animate-shake border-red-400 bg-red-50',
                  )}
                >
                  {t.text}
                </button>
              );
            })}
          </div>
          <p className="text-center text-[13px] text-slate-500">Chọn một từ tiếng Anh rồi chọn nghĩa tương ứng. Đồng hồ chạy từ lần chạm đầu tiên.</p>
        </>
      )}
    </div>
  );
}
