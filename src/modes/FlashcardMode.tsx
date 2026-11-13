import { ChevronLeft, ChevronRight, PartyPopper, RotateCcw, Shuffle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, CategoryBadge, EmptyState, PosTag, SpeakButton, StarButton } from '../components/common';
import { useProgress, wordStatus } from '../lib/progress';
import { shuffle } from '../lib/text';
import { celebrate, cx, useSpeak } from '../lib/ui';
import type { VocabItem } from '../types/vocab';

const SWIPE = 90;

export function FlashcardMode({ words, scope }: { words: VocabItem[]; scope: string }) {
  const { state, setStatus, updateScore } = useProgress();
  const speak = useSpeak();
  const [onlyUnlearned, setOnlyUnlearned] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [seed, setSeed] = useState(0);

  // Build the deck once per (filter, shuffle, restart) — not on every progress change.
  const deck = useMemo(() => {
    const base = onlyUnlearned ? words.filter((w) => wordStatus(state.words[w.id]) !== 'mastered') : words;
    return shuffled ? shuffle(base) : base.slice(); // new array each time so "Học lại" resets
  }, [words, onlyUnlearned, shuffled, seed]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [session, setSession] = useState({ mastered: 0, learning: 0 });
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const done = idx >= deck.length;
  const card = deck[Math.min(idx, deck.length - 1)];

  useEffect(() => {
    setIdx(0);
    setFlipped(false);
    setSession({ mastered: 0, learning: 0 });
  }, [deck]);

  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setDx(0);
      setIdx((i) => Math.max(0, Math.min(deck.length, i + delta)));
    },
    [deck.length],
  );

  const mark = useCallback(
    (status: 'mastered' | 'learning') => {
      if (!card || done) return;
      setStatus(card.id, status);
      setSession((s) => ({ ...s, [status]: s[status] + 1 }));
      if (idx + 1 >= deck.length) {
        updateScore(scope, (p) => p);
        celebrate();
      }
      go(1);
    },
    [card, done, setStatus, idx, deck.length, updateScore, scope, go],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (done) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key.toLowerCase() === 's') card && speak(card.speakText);
      else if (e.key === '1') mark('learning');
      else if (e.key === '2') mark('mastered');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, go, card, speak, mark]);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
        <input type="checkbox" checked={onlyUnlearned} onChange={(e) => setOnlyUnlearned(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
        Chỉ thẻ chưa thuộc
      </label>
      <button
        type="button"
        onClick={() => {
          setShuffled(true);
          setSeed((s) => s + 1);
        }}
        className={cx('inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ring-1 transition', shuffled ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}
      >
        <Shuffle className="h-4 w-4" /> Trộn thẻ
      </button>
      {shuffled && (
        <button type="button" onClick={() => setShuffled(false)} className="min-h-[40px] rounded-xl px-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
          Theo thứ tự
        </button>
      )}
    </div>
  );

  if (deck.length === 0) {
    return (
      <div className="space-y-3">
        {toolbar}
        <EmptyState icon={<PartyPopper className="h-12 w-12" />} title="Thẻ nào bạn cũng thuộc rồi">
          Không còn thẻ chưa thuộc. Bỏ chọn “Chỉ thẻ chưa thuộc” để ôn lại toàn bộ.
        </EmptyState>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3">
        {toolbar}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center md:p-10">
          <PartyPopper className="mx-auto h-12 w-12 text-indigo-500" />
          <h3 className="mt-3 text-2xl text-slate-900">Xong {deck.length} thẻ</h3>
          <p className="mt-1 text-slate-500">
            <span className="font-bold text-emerald-600">{session.mastered} đã thuộc</span> · <span className="font-bold text-orange-600">{session.learning} cần ôn lại</span>
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setSeed((s) => s + 1)}>
              <RotateCcw className="h-4 w-4" /> Học lại
            </Button>
            {!onlyUnlearned && (
              <Button variant="secondary" onClick={() => setOnlyUnlearned(true)}>
                Chỉ ôn thẻ chưa thuộc
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const status = wordStatus(state.words[card.id]);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    if (!d.moved && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(e.clientY - d.y)) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (d.moved) setDx(mx);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      setFlipped((f) => !f);
      return;
    }
    if (dx > SWIPE) mark('mastered');
    else if (dx < -SWIPE) mark('learning');
    else setDx(0);
  };

  return (
    <div className="space-y-3">
      {toolbar}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${((idx + 1) / deck.length) * 100}%` }} />
        </div>
        <span className="text-sm font-bold tabular-nums text-slate-500">
          {idx + 1}/{deck.length}
        </span>
      </div>

      <div className="perspective relative mx-auto w-full max-w-xl select-none">
        {dx !== 0 && (
          <div className={cx('pointer-events-none absolute inset-x-0 -top-1 z-10 text-center text-sm', dx > 0 ? 'text-emerald-600' : 'text-orange-600')} style={{ opacity: Math.min(1, Math.abs(dx) / SWIPE) }}>
            {dx > 0 ? '✓ Đã thuộc' : '↺ Cần ôn lại'}
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label={flipped ? 'Mặt sau – chạm để lật lại' : 'Mặt trước – chạm để lật'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setDx(0);
          }}
          onKeyDown={(e) => e.key === 'Enter' && setFlipped((f) => !f)}
          className="relative h-[calc(100dvh-330px)] max-h-[440px] min-h-[260px] cursor-pointer md:h-[min(56dvh,420px)] md:min-h-[300px] outline-none [touch-action:pan-y]"
          style={{ transform: `translateX(${dx}px) rotate(${dx / 25}deg)`, transition: dx === 0 || !drag.current ? 'transform 0.25s' : 'none' }}
        >
          <div className={cx('preserve-3d relative h-full w-full transition-transform duration-500', flipped && 'rotate-y-180')}>
            {/* front */}
            <div
              className={cx(
                'backface-hidden absolute inset-0 flex flex-col overflow-hidden rounded-3xl border border-slate-300 bg-white p-5',
              )}
            >
              {/* an index card: one coloured rule across the top */}
              <span className={cx('absolute inset-x-0 top-0 h-1.5', status === 'mastered' ? 'bg-indigo-600' : status === 'learning' ? 'bg-orange-500' : 'bg-slate-900')} aria-hidden />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CategoryBadge category={card.category} />
                  {status !== 'new' && <span className={cx('text-[13px] font-medium', status === 'mastered' ? 'text-indigo-700' : 'text-orange-700')}>{status === 'mastered' ? 'Đã thuộc' : 'Đang học'}</span>}
                </span>
                <StarButton id={card.id} />
              </div>
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="font-display text-[38px] font-semibold leading-[1.1] tracking-tight text-slate-900 md:text-5xl">{card.term}</div>
                <div className="mt-2 flex items-center gap-2">
                  <PosTag pos={card.pos} />
                  {card.ipa && <span className="font-mono text-base text-slate-500">{card.ipa}</span>}
                </div>
                <SpeakButton word={card} size="lg" className="mt-5 bg-slate-100 text-slate-900 hover:bg-slate-200" />
              </div>
              <p className="text-center text-[13px] text-slate-500">Chạm để lật. Vuốt phải nếu đã thuộc, vuốt trái để ôn lại.</p>
            </div>
            {/* back */}
            <div
              className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col rounded-3xl border border-slate-300 bg-white p-5"
              style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 39px, rgb(13 116 128 / 0.08) 39px 40px)', backgroundPosition: '0 72px' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold text-slate-600">{card.term}</span>
                <SpeakButton word={card} size="sm" />
              </div>
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="rounded-lg bg-white/90 px-2 text-[26px] font-semibold leading-snug text-slate-900 md:text-[32px]">{card.meaning}</div>
                {card.note && <div className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-[15px] text-slate-700">{card.note}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-xl grid-cols-[auto_1fr_1fr_auto] gap-2">
        <button type="button" onClick={() => go(-1)} disabled={idx === 0} className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 disabled:opacity-30" aria-label="Thẻ trước">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Button variant="warn" onClick={() => mark('learning')} className="h-12">
          Cần ôn lại
        </Button>
        <Button onClick={() => mark('mastered')} className="h-12">
          Đã thuộc
        </Button>
        <button type="button" onClick={() => go(1)} className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200" aria-label="Thẻ tiếp theo">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <p className="hidden text-center text-[13px] text-slate-400 md:block">
        Phím tắt: <kbd className="rounded bg-slate-200 px-1.5 font-sans">Space</kbd> lật · <kbd className="rounded bg-slate-200 px-1.5">←</kbd>
        <kbd className="ml-1 rounded bg-slate-200 px-1.5">→</kbd> chuyển thẻ · <kbd className="rounded bg-slate-200 px-1.5">S</kbd> phát âm · <kbd className="rounded bg-slate-200 px-1.5">1</kbd> cần ôn ·{' '}
        <kbd className="rounded bg-slate-200 px-1.5">2</kbd> đã thuộc
      </p>
    </div>
  );
}
