import { Keyboard, Layers, List, Puzzle, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { FlashcardMode } from '../modes/FlashcardMode';
import { ListMode } from '../modes/ListMode';
import { MatchMode } from '../modes/MatchMode';
import { QuizMode } from '../modes/QuizMode';
import { SpellMode } from '../modes/SpellMode';
import { cx } from '../lib/ui';
import type { StudyMode, VocabItem } from '../types/vocab';

export const MODE_META: Record<StudyMode, { label: string; short: string; icon: ReactNode }> = {
  list: { label: 'Danh sách', short: 'Danh sách', icon: <List className="h-4 w-4" /> },
  flashcards: { label: 'Flashcards', short: 'Thẻ', icon: <Layers className="h-4 w-4" /> },
  quiz: { label: 'Trắc nghiệm', short: 'Trắc nghiệm', icon: <Target className="h-4 w-4" /> },
  match: { label: 'Ghép thẻ', short: 'Ghép thẻ', icon: <Puzzle className="h-4 w-4" /> },
  spell: { label: 'Gõ từ', short: 'Gõ từ', icon: <Keyboard className="h-4 w-4" /> },
};

export function ModeTabs({ mode, hrefFor }: { mode: StudyMode; hrefFor: (m: StudyMode) => string }) {
  return (
    <nav className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Chế độ học">
      {(Object.keys(MODE_META) as StudyMode[]).map((m) => (
        <a
          key={m}
          href={hrefFor(m)}
          aria-current={m === mode ? 'page' : undefined}
          className={cx(
            'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-4 text-[15px] font-medium transition-colors',
            m === mode ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-400',
          )}
        >
          {MODE_META[m].icon}
          {MODE_META[m].label}
        </a>
      ))}
    </nav>
  );
}

export function StudyArea({ mode, words, scope, showUnit }: { mode: StudyMode; words: VocabItem[]; scope: string; showUnit?: boolean }) {
  switch (mode) {
    case 'flashcards':
      return <FlashcardMode words={words} scope={scope} />;
    case 'quiz':
      return <QuizMode words={words} scope={scope} />;
    case 'match':
      return <MatchMode words={words} scope={scope} />;
    case 'spell':
      return <SpellMode words={words} scope={scope} />;
    default:
      return <ListMode words={words} showUnit={showUnit} />;
  }
}
