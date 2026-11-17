import { href } from '../../lib/router';
import type { TypeAccuracy } from '../../lib/stats';
import { MIN_ANSWERS } from '../../lib/stats';
import { QUESTION_TYPE_LABEL } from '../../types/exam';

// Horizontal bars, one hue (single measure): 16px thick, 4px rounded tip, square at the baseline,
// value at the tip, hairline grid at 0/50/100%. Counts sit under each label, so nothing needs a hover.
// Each row links to practice of that type.
const ACCENT = '#0d7480';

export function TypeBars({ rows }: { rows: TypeAccuracy[] }) {
  return (
    <div className="space-y-1" role="list">
      {rows.map((r) => {
        const n = r.right + r.wrong;
        const pct = r.rate !== undefined ? Math.round(r.rate * 100) : undefined;
        return (
          <a
            key={r.type}
            role="listitem"
            href={href.practice(r.type)}
            className="group grid grid-cols-[minmax(7.5rem,10rem)_1fr] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 focus-visible:bg-slate-50"
            aria-label={`${QUESTION_TYPE_LABEL[r.type]}: ${pct !== undefined ? `đúng ${pct}%, ${r.right} trên ${n} lượt` : `mới ${n} lượt, chưa đủ để tính`}. Luyện dạng này.`}
          >
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium text-slate-800 group-hover:text-slate-950">{QUESTION_TYPE_LABEL[r.type]}</span>
              <span className="block text-[12px] tabular-nums text-slate-500">{n ? `${r.right}/${n} lượt đúng` : 'chưa làm'}</span>
            </span>
            <span className="relative flex h-6 items-center">
              {/* grid spans the bar area only; the last 3rem holds the value at the tip */}
              <span className="absolute inset-y-0 left-0 right-12" aria-hidden>
                {[0, 50, 100].map((g) => (
                  <span key={g} className="absolute inset-y-0 w-px bg-slate-200" style={{ left: `${g}%` }} />
                ))}
              </span>
              {pct !== undefined ? (
                <span className="relative flex w-[calc(100%-3rem)] items-center">
                  <span className="h-4 rounded-r" style={{ width: `${Math.max(pct, 1)}%`, background: ACCENT }} />
                  <span className="ml-2 text-[14px] font-semibold tabular-nums text-slate-900">{pct}%</span>
                </span>
              ) : (
                <span className="relative pl-2 text-[13px] text-slate-500">cần ít nhất {MIN_ANSWERS} lượt</span>
              )}
            </span>
          </a>
        );
      })}
    </div>
  );
}
