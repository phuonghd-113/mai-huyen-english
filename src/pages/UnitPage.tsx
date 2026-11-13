import { useEffect } from 'react';
import { ProgressBar } from '../components/common';
import { MobileHeader } from '../components/Layout';
import { MODE_META, ModeTabs, StudyArea } from '../components/StudySession';
import { useProgress } from '../lib/progress';
import { href } from '../lib/router';
import { cx, UnitNumber } from '../lib/ui';
import type { StudyMode, UnitData } from '../types/vocab';
import { CATEGORY_LABEL } from '../data';

export function UnitPage({ unit, mode }: { unit: UnitData; mode: StudyMode }) {
  const { masteredCount, touchUnit } = useProgress();
  useEffect(() => touchUnit(unit.id), [unit.id, touchUnit]);
  const mastered = masteredCount(unit.words);
  const counts = unit.words.reduce<Record<string, number>>((acc, w) => ((acc[w.category] = (acc[w.category] ?? 0) + 1), acc), {});
  const num = String(unit.unitNumber).padStart(2, '0');

  return (
    <>
      <MobileHeader title={`Unit ${num} · ${MODE_META[mode].label}`} back={href.units()} />
      <main className="mx-auto w-full max-w-5xl px-4 py-4 md:px-10 md:py-10">
        {/* On phones the study modes get the full height; the top bar already names the unit. */}
        <header className={cx('mb-5 items-end gap-5 md:mb-7 md:flex', mode === 'list' ? 'flex' : 'hidden')}>
          <UnitNumber n={unit.unitNumber} className="text-[64px] text-slate-900 md:text-[88px]" />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-2xl leading-tight text-slate-900 md:text-[32px]">{unit.title}</h1>
            <p className="mt-0.5 text-[15px] text-slate-600">
              {unit.viTitle} · {unit.words.length} mục: {Object.entries(counts).map(([k, v]) => `${v} ${CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL].toLowerCase()}`).join(', ')}
            </p>
            <div className="mt-3 flex max-w-sm items-center gap-3">
              <ProgressBar value={mastered / unit.words.length} className="h-1.5" />
              <span className="shrink-0 text-[13px] text-slate-600 tabular">
                {mastered}/{unit.words.length} đã thuộc
              </span>
            </div>
          </div>
        </header>
        <ModeTabs mode={mode} hrefFor={(m) => href.unit(unit.id, m)} />
        <div className="mt-4">
          <StudyArea key={mode} mode={mode} words={unit.words} scope={unit.id} />
        </div>
      </main>
    </>
  );
}
