import { useEffect, useState } from 'react';
import type { Accent } from '../types/vocab';

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

function refresh() {
  if (!speechSupported) return;
  voices = window.speechSynthesis.getVoices();
  listeners.forEach((l) => l());
}

if (speechSupported) {
  refresh();
  window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
}

const lang = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();

/** Best voice for the accent: exact accent → any English → none (browser default). */
export function pickVoice(accent: Accent): { voice: SpeechSynthesisVoice | null; exact: boolean } {
  const want = accent.toLowerCase();
  const rank = (v: SpeechSynthesisVoice) => (v.localService ? 0 : 1);
  const exact = voices.filter((v) => lang(v) === want).sort((a, b) => rank(a) - rank(b));
  if (exact.length) return { voice: exact[0], exact: true };
  const english = voices.filter((v) => lang(v).startsWith('en')).sort((a, b) => rank(a) - rank(b));
  return { voice: english[0] ?? null, exact: false };
}

export function speak(text: string, opts: { accent: Accent; rate: number }): boolean {
  if (!speechSupported || !text) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const { voice } = pickVoice(opts.accent);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? opts.accent;
    u.rate = opts.rate;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

/** Re-renders when the voice list arrives (it loads asynchronously in Chrome). */
export function useVoices(): SpeechSynthesisVoice[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return voices;
}
