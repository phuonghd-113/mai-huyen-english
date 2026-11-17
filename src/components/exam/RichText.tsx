import { Fragment } from 'react';
import { LETTERS } from '../../lib/grade';

/**
 * Exam text with <u>…</u> underlines, rendered without innerHTML (the files come from imported papers).
 * `letterParts` labels each underlined part A, B, C… (error identification).
 */
export function RichText({ text, letterParts, className }: { text: string; letterParts?: boolean; className?: string }) {
  const parts = text.split(/(<u>[\s\S]*?<\/u>)/g);
  let n = 0;
  return (
    <span className={className ? `${className} whitespace-pre-line` : 'whitespace-pre-line'}>
      {parts.map((p, i) => {
        const m = p.match(/^<u>([\s\S]*?)<\/u>$/);
        if (!m) return <Fragment key={i}>{p.replace(/<\/?u>/g, '')}</Fragment>;
        const letter = letterParts ? LETTERS[n++] : undefined;
        return (
          <Fragment key={i}>
            <u className="decoration-slate-500 decoration-[1.5px] underline-offset-[5px]">{m[1]}</u>
            {letter && <sub className="ml-0.5 font-sans text-[11px] font-bold text-indigo-700">{letter}</sub>}
          </Fragment>
        );
      })}
    </span>
  );
}
