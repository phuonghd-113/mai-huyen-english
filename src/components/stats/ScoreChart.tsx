import { useEffect, useRef, useState } from 'react';
import { formatDate, formatScore } from '../../lib/exam-ui';
import type { ScorePoint } from '../../lib/stats';

// Single series: no legend (the heading names it). Marks per the dataviz spec: 2px line, ~10% area wash,
// r=4 dots with a 2px surface ring, hairline grid, value label at the end only, crosshair + tooltip.
const ACCENT = '#0d7480'; // accent-600
const GRID = '#dde3e6'; // slate-200
const AXIS_TEXT = '#5d6b72'; // slate-500
const SURFACE = '#ffffff';
const H = 220;
const PAD = { top: 16, right: 44, bottom: 30, left: 34 };

function ticksFor(scale: number): number[] {
  const step = scale === 10 ? 2.5 : scale / 4;
  return Array.from({ length: Math.round(scale / step) + 1 }, (_, i) => i * step);
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function ScoreChart({ points, scale }: { points: ScorePoint[]; scale: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / scale) * innerH;
  const val = (p: ScorePoint) => p.ratio * scale;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(val(p))}`).join('');
  const area = n > 1 ? `${line}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : '';
  const last = points[n - 1];

  const nearest = (clientX: number, rect: DOMRect) => {
    if (n === 1) return 0;
    const rel = (clientX - rect.left - PAD.left) / innerW;
    return Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(n - 1, (a ?? n - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Escape') setActive(null);
  };

  const a = active !== null ? points[active] : null;
  const tipLeft = a ? Math.min(Math.max(x(active!) - 90, 0), Math.max(0, width - 180)) : 0;
  const same = (p: ScorePoint) => p.max === scale;

  return (
    <div ref={ref} className="relative w-full select-none">
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          tabIndex={0}
          aria-label={`Điểm ${n} lần thi thử, quy về thang ${scale}. Lần gần nhất ${formatScore(round2(val(last)))}. Dùng phím mũi tên để xem từng lần.`}
          className="block rounded-lg outline-offset-4"
          onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {ticksFor(scale).map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={12} fill={AXIS_TEXT} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatScore(t)}
              </text>
            </g>
          ))}
          <text x={x(0)} y={H - 8} textAnchor={n === 1 ? 'middle' : 'start'} fontSize={12} fill={AXIS_TEXT}>
            {shortDate(points[0].submittedAt)}
          </text>
          {n > 1 && (
            <text x={x(n - 1)} y={H - 8} textAnchor="end" fontSize={12} fill={AXIS_TEXT}>
              {shortDate(last.submittedAt)}
            </text>
          )}
          {area && <path d={area} fill={ACCENT} fillOpacity={0.1} />}
          {n > 1 && <path d={line} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {a && <line x1={x(active!)} x2={x(active!)} y1={PAD.top} y2={y(0)} stroke={AXIS_TEXT} strokeWidth={1} shapeRendering="crispEdges" />}
          {points.map((p, i) => (
            <circle key={p.attemptId} cx={x(i)} cy={y(val(p))} r={i === active ? 5.5 : 4} fill={ACCENT} stroke={SURFACE} strokeWidth={2} />
          ))}
          <text x={x(n - 1) + 10} y={y(val(last))} dy="0.32em" fontSize={13} fontWeight={600} fill="#1f3038" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatScore(round2(val(last)))}
          </text>
        </svg>
      )}
      {a && (
        <div className="pointer-events-none absolute top-0 w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] shadow-lg" style={{ left: tipLeft }} role="status">
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: ACCENT }} aria-hidden />
            <b className="text-[15px] font-semibold text-slate-900">
              {formatScore(a.score)}/{formatScore(a.max)}
            </b>
            {!same(a) && <span className="text-slate-500">≈ {formatScore(round2(val(a)))}/{scale}</span>}
          </div>
          <div className="mt-0.5 truncate text-slate-600">{a.title}</div>
          <div className="text-slate-500">{formatDate(a.submittedAt)}</div>
        </div>
      )}
    </div>
  );
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const shortDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};
