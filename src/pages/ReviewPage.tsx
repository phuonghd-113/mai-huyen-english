import { Flame, PartyPopper, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, EmptyState } from '../components/common';
import { MobileHeader } from '../components/Layout';
import { MODE_META, ModeTabs, StudyArea } from '../components/StudySession';
import { ALL_WORDS, UNITS } from '../data';
import { isHard, useProgress } from '../lib/progress';
import { href } from '../lib/router';
import type { StudyMode } from '../types/vocab';

export function ReviewPage({ mode }: { mode: StudyMode }) {
  const { state } = useProgress();
  const [unitFilter, setUnitFilter] = useState('all');
  // Snapshot the hard-word list so cards don't vanish mid-session when a word gets marked mastered.
  const [version, setVersion] = useState(0);
  const words = useMemo(
    () => ALL_WORDS.filter((w) => isHard(state.words[w.id]) && (unitFilter === 'all' || w.unitId === unitFilter)),
    [mode, unitFilter, version],
  );
  const liveCount = useMemo(() => ALL_WORDS.filter((w) => isHard(state.words[w.id]) && (unitFilter === 'all' || w.unitId === unitFilter)).length, [state.words, unitFilter]);

  return (
    <>
      <MobileHeader title={`Ôn tập · ${MODE_META[mode].label}`} back={href.home()} />
      <main className="mx-auto w-full max-w-5xl px-4 py-4 md:px-8 md:py-8">
        <header className="mb-4 flex flex-wrap items-start gap-3 md:mb-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 md:h-14 md:w-14">
            <Flame className="h-6 w-6 md:h-7 md:w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl text-slate-900 md:text-2xl">Ôn tập từ khó</h1>
            <p className="text-sm text-slate-500">Từ gắn sao, đang học, hoặc từng làm sai mà chưa thuộc · {words.length} mục</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 sm:flex-none"
              aria-label="Lọc theo Unit"
            >
              <option value="all">Tất cả Units</option>
              {UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {String(u.unitNumber).padStart(2, '0')} – {u.title}
                </option>
              ))}
            </select>
            {liveCount !== words.length && (
              <Button variant="secondary" onClick={() => setVersion((v) => v + 1)} className="shrink-0">
                <RefreshCw className="h-4 w-4" /> Cập nhật ({liveCount})
              </Button>
            )}
          </div>
        </header>
        <ModeTabs mode={mode} hrefFor={(m) => href.review(m)} />
        <div className="mt-4">
          {words.length === 0 ? (
            <EmptyState icon={<PartyPopper className="h-12 w-12" />} title="Chưa có từ khó nào">
              Bấm ⭐ để gắn sao, bấm “Cần ôn lại” trong Flashcards, hoặc làm Trắc nghiệm/Gõ từ: những từ làm sai sẽ tự động xuất hiện ở đây.
            </EmptyState>
          ) : (
            <StudyArea key={`${mode}-${unitFilter}-${version}`} mode={mode} words={words} scope="review" showUnit />
          )}
        </div>
      </main>
    </>
  );
}
