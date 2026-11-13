import { Check, Star, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useProgress, wordStatus } from '../lib/progress';
import { cx, useSpeak } from '../lib/ui';
import type { VocabItem } from '../types/vocab';
import { CATEGORY_LABEL } from '../data';

export function ProgressBar({ value, className, barClass = 'bg-indigo-500' }: { value: number; className?: string; barClass?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all duration-500', barClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SpeakButton({ word, size = 'md', className }: { word: Pick<VocabItem, 'speakText' | 'term'>; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const speak = useSpeak();
  const dim = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';
  const icon = size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(word.speakText);
      }}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full text-indigo-600 transition hover:bg-indigo-50 active:scale-95', dim, className)}
      aria-label={`Phát âm ${word.term}`}
      title="Phát âm"
    >
      <Volume2 className={icon} />
    </button>
  );
}

export function StarButton({ id, className }: { id: string; className?: string }) {
  const { get, toggleStar } = useProgress();
  const on = !!get(id)?.starred;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleStar(id);
      }}
      className={cx('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95', on ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-400', className)}
      aria-label={on ? 'Bỏ gắn sao' : 'Gắn sao'}
      aria-pressed={on}
      title={on ? 'Bỏ gắn sao' : 'Gắn sao (từ khó)'}
    >
      <Star className="h-[18px] w-[18px]" fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}

export function MasteredButton({ id, className }: { id: string; className?: string }) {
  const { get, setStatus } = useProgress();
  const status = wordStatus(get(id));
  const on = status === 'mastered';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setStatus(id, on ? 'learning' : 'mastered');
      }}
      className={cx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition active:scale-95',
        on ? 'border-indigo-600 bg-indigo-600 text-white' : status === 'learning' ? 'border-orange-300 text-orange-400 hover:bg-orange-50' : 'border-slate-200 text-slate-300 hover:bg-slate-50',
      )}
      aria-label={on ? 'Đã thuộc – bấm để chuyển về Đang học' : 'Đánh dấu đã thuộc'}
      aria-pressed={on}
      title={on ? 'Đã thuộc' : status === 'learning' ? 'Đang học – bấm khi đã thuộc' : 'Đánh dấu đã thuộc'}
    >
      <Check className="h-[18px] w-[18px]" strokeWidth={3} />
    </button>
  );
}

const CAT_STYLE: Record<VocabItem['category'], string> = {
  word: 'bg-slate-100 text-slate-700',
  'phrasal-verb': 'bg-indigo-50 text-indigo-800',
  phrase: 'text-slate-600 ring-1 ring-inset ring-slate-300',
};

export function CategoryBadge({ category }: { category: VocabItem['category'] }) {
  return <span className={cx('inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[13px] font-medium leading-5', CAT_STYLE[category])}>{CATEGORY_LABEL[category]}</span>;
}

export function PosTag({ pos }: { pos: string }) {
  if (!pos) return null;
  return <span className="whitespace-nowrap font-mono text-[13px] text-slate-500">{pos}</span>;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cx('inline-flex rounded-xl bg-slate-100 p-1', className)} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-[36px] flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition',
            o.value === value ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
      <div className="mb-3 text-slate-400">{icon}</div>
      <h3 className="text-lg font-bold text-slate-700">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-[15px] text-slate-600">{children}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-slate-200 bg-white', className)}>{children}</div>;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'success' | 'warn';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-white text-slate-800 border border-slate-300 hover:border-slate-500',
    ghost: 'text-slate-700 hover:bg-slate-100',
    success: 'bg-indigo-600 text-white hover:bg-indigo-700',
    warn: 'bg-white text-orange-800 border border-orange-300 hover:border-orange-500',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx('btn-step inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold disabled:pointer-events-none disabled:opacity-40', styles, className)}
    >
      {children}
    </button>
  );
}
