import { useProgress } from '../lib/progress';
import { href } from '../lib/router';
import { cx, UnitNumber } from '../lib/ui';
import type { UnitData } from '../types/vocab';
import { ProgressBar } from './common';

export function UnitCard({ unit, current }: { unit: UnitData; current?: boolean }) {
  const { masteredCount, state } = useProgress();
  const mastered = masteredCount(unit.words);
  const done = mastered === unit.words.length;
  const best = state.scores[unit.id]?.bestQuiz;
  return (
    <a
      href={href.unit(unit.id)}
      className={cx(
        'lift group flex flex-col rounded-2xl border bg-white p-5',
        current ? 'border-slate-900' : 'border-slate-200',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <UnitNumber n={unit.unitNumber} className={cx('text-[44px]', done ? 'text-indigo-600' : 'text-slate-900')} />
        {current && <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[13px] font-medium text-white">Đang học</span>}
        {!current && done && <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[13px] font-medium text-indigo-800">Đã thuộc hết</span>}
      </div>
      <h3 className="mt-4 text-lg leading-tight text-slate-900">{unit.title}</h3>
      <p className="text-[15px] text-slate-600">{unit.viTitle}</p>
      <div className="mt-auto pt-5">
        <div className="mb-1.5 flex items-baseline justify-between text-[13px] text-slate-500">
          <span className="tabular">
            <b className="font-semibold text-slate-900">{mastered}</b>/{unit.words.length} từ đã thuộc
          </span>
          {best !== undefined && <span className="tabular">Quiz cao nhất {best}%</span>}
        </div>
        <ProgressBar value={mastered / unit.words.length} className="h-1.5" />
      </div>
    </a>
  );
}
