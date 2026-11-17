import { formatScore, sectionLabel } from '../../lib/exam-ui';
import { questionType } from '../../lib/grade';
import { cx } from '../../lib/ui';
import { QUESTION_TYPE_LABEL, type Question, type Section } from '../../types/exam';
import { QuestionView } from './QuestionView';
import { RichText } from './RichText';

interface Props {
  section: Section;
  index: number;
  answers: Record<string, string>;
  onAnswer?: (key: string, value: string) => void;
  flagged?: ReadonlySet<string>;
  onFlag?: (questionId: string) => void;
  /** review: only show these questions (e.g. the wrong ones) */
  only?: (q: Question) => boolean;
}

export function SectionView({ section, index, answers, onAnswer, flagged, onFlag, only }: Props) {
  const shown = section.questions.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => !only || only(q));
  const hasPassage = !!section.passage?.trim();
  return (
    <section aria-labelledby={`sec-${section.id}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={`sec-${section.id}`} className="text-[22px] text-slate-900">
          Phần {sectionLabel(index)}
        </h2>
        <span className="text-[15px] text-slate-600">
          {QUESTION_TYPE_LABEL[section.type]} · {section.questions.length} câu · {formatScore(section.points)} điểm
        </span>
      </div>
      <p className="mt-1 text-[16px] font-medium leading-relaxed text-slate-800">{section.instruction}</p>

      <div className={cx('mt-3', hasPassage && 'md:grid md:grid-cols-2 md:items-start md:gap-6')}>
        {hasPassage && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:sticky md:top-32 md:max-h-[calc(100dvh-10rem)] md:overflow-y-auto">
            <RichText text={section.passage!} className="block text-[17px] leading-[1.75] text-slate-900" />
          </div>
        )}
        <div className={cx('divide-y divide-slate-100', hasPassage && 'mt-2 md:mt-0')}>
          {shown.map(({ q, n }) => (
            <QuestionView
              key={q.id}
              q={q}
              type={questionType(q, section)}
              number={n}
              answers={answers}
              onAnswer={onAnswer}
              flagged={flagged?.has(q.id)}
              onFlag={onFlag && (() => onFlag(q.id))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
