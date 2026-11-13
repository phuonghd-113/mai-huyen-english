import confetti from 'canvas-confetti';
import {
  Briefcase,
  Building2,
  Gamepad2,
  Globe2,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  Palette,
  Plane,
  Send,
  ShoppingCart,
  Smile,
  Users,
  Wrench,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { useCallback } from 'react';
import { useProgress } from './progress';
import { speak } from './speech';

export const UNIT_ICONS: Record<string, LucideIcon> = {
  Gamepad2,
  GraduationCap,
  Plane,
  Users,
  ShoppingCart,
  Lightbulb,
  Send,
  Building2,
  Briefcase,
  HeartPulse,
  Palette,
  Globe2,
  Smile,
  Wrench,
};

export function UnitIcon({ name, className }: { name: string; className?: string }) {
  const I = UNIT_ICONS[name] ?? BookOpen;
  return <I className={className} aria-hidden />;
}

/** One system: every unit shares the neutral look; the accent only marks progress. */
const NEUTRAL = { solid: 'bg-slate-900', soft: 'bg-slate-100 text-slate-700', bar: 'bg-indigo-600', ring: 'ring-slate-200' };

export function unitColor(_color?: string) {
  return NEUTRAL;
}

/** The unit number set large in the display face, like a textbook's contents page. */
export function UnitNumber({ n, className }: { n: number; className?: string }) {
  return <span className={cx('font-display font-semibold tabular-nums leading-none tracking-tight', className)}>{String(n).padStart(2, '0')}</span>;
}

export function useSpeak() {
  const { state } = useProgress();
  const { accent, rate } = state.settings;
  return useCallback((text: string) => speak(text, { accent, rate }), [accent, rate]);
}

export function celebrate() {
  try {
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ['#0d7480', '#1f3038', '#78bcc3', '#e9a23b'], disableForReducedMotion: true });
  } catch {
    /* ignore */
  }
}

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}
