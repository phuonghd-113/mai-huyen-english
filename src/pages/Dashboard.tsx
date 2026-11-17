import { ArrowRight, ClipboardList, Search, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Card, PosTag, ProgressBar, SpeakButton, StarButton } from '../components/common';
import { MobileHeader } from '../components/Layout';
import { UnitCard } from '../components/UnitCard';
import { ALL_WORDS, UNIT_BY_ID, UNITS } from '../data';
import { isHard, useProgress } from '../lib/progress';
import { href } from '../lib/router';
import { foldVi } from '../lib/text';


const SEARCH_INDEX = ALL_WORDS.map((w) => ({ w, en: w.term.toLowerCase(), vi: foldVi(w.meaning) }));

function GlobalSearch() {
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q.trim());
  const results = useMemo(() => {
    if (dq.length < 2) return [];
    const en = dq.toLowerCase();
    const vi = foldVi(dq);
    const starts: typeof ALL_WORDS = [];
    const contains: typeof ALL_WORDS = [];
    for (const { w, en: e, vi: v } of SEARCH_INDEX) {
      if (e.startsWith(en)) starts.push(w);
      else if (e.includes(en) || v.includes(vi)) contains.push(w);
    }
    return [...starts, ...contains].slice(0, 30);
  }, [dq]);

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Tìm từ trong cả 14 unit</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tra từ, tiếng Anh hoặc tiếng Việt"
          className="h-14 w-full rounded-2xl border border-slate-300 bg-white pl-12 pr-12 text-[17px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-500 focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-100"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="Xóa tìm kiếm">
            <X className="h-4 w-4" />
          </button>
        )}
      </label>
      {dq.length >= 2 && (
        <Card className="mt-2 divide-y divide-slate-100 overflow-hidden">
          {results.length === 0 && <p className="p-4 text-sm text-slate-500">Không tìm thấy từ nào khớp với “{dq}”.</p>}
          {results.map((w) => {
            const u = UNIT_BY_ID.get(w.unitId)!;
            return (
              <div key={w.id} className="flex items-center gap-2 px-3 py-2">
                <SpeakButton word={w} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[17px] font-semibold text-slate-900">{w.term}</span>
                    <PosTag pos={w.pos} />
                    {w.ipa && <span className="font-mono text-[13px] text-slate-500">{w.ipa}</span>}
                  </div>
                  <div className="text-[15px] text-slate-700">{w.meaning}</div>
                </div>
                <a href={href.unit(u.id)} className="link-draw hidden shrink-0 text-[13px] font-medium text-slate-600 sm:inline-block">
                  Unit {String(u.unitNumber).padStart(2, '0')}
                </a>
                <StarButton id={w.id} />
              </div>
            );
          })}
          {results.length === 30 && <p className="p-3 text-center text-[13px] text-slate-500">Đang hiện 30 kết quả đầu. Gõ thêm vài chữ để thu hẹp.</p>}
        </Card>
      )}
    </div>
  );
}

export function Dashboard() {
  const { state, sync } = useProgress();
  const { mastered, hard } = useMemo(() => {
    let mastered = 0;
    let hard = 0;
    for (const w of ALL_WORDS) {
      const p = state.words[w.id];
      if (p?.status === 'mastered') mastered++;
      if (isHard(p)) hard++;
    }
    return { mastered, hard };
  }, [state.words]);
  const last = state.lastUnitId ? UNIT_BY_ID.get(state.lastUnitId) : undefined;
  const next = last ?? UNITS[0];
  const total = ALL_WORDS.length;

  let status: string;
  if (mastered === 0) status = `Chưa thuộc từ nào. Mỗi ngày một unit là xong sách trong hai tuần.`;
  else if (mastered === total) status = `Bạn đã thuộc cả ${total} từ của sách.`;
  else status = `Bạn đã thuộc ${mastered} trên ${total} từ.` + (hard > 0 ? ` Còn ${hard} từ khó đang chờ ôn lại.` : '');

  return (
    <>
      <MobileHeader title="Từ vựng Destination B1" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 md:px-10 md:pt-12">
        <section className="enter max-w-3xl">
          <p className="text-[15px] text-slate-600">Destination B1 · 14 unit · {total} từ và cụm từ</p>
          <h1 className="mt-2 text-balance text-[34px] leading-[1.08] text-slate-900 md:text-[52px]">Học từ vựng tiếng Anh theo từng unit</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-slate-700">{status}</p>
          <div className="mt-4 max-w-md">
            <ProgressBar value={mastered / total} className="h-2" />
          </div>
          {!sync.account && (
            <p className="mt-3 text-[15px] text-slate-600">
              Tiến độ đang chỉ lưu trên máy này.{' '}
              <a href={href.settings()} className="link-draw font-medium text-indigo-700">
                Đăng nhập để học tiếp trên máy khác
              </a>
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <a href={href.unit(next.id)} className="btn-step inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700">
              {last ? 'Học tiếp' : 'Bắt đầu với'} Unit {String(next.unitNumber).padStart(2, '0')}
              <ArrowRight className="h-4 w-4" />
            </a>
            {hard > 0 && (
              <a href={href.review('flashcards')} className="btn-step inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-800 hover:border-slate-500">
                Ôn {hard} từ khó
              </a>
            )}
          </div>
        </section>

        <section className="mt-10 md:mt-14">
          <a href={href.exams()} className="lift flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <ClipboardList className="h-8 w-8 shrink-0 text-indigo-600" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[19px] font-semibold text-slate-900">Thi thử HSG lớp 8</span>
              <span className="block text-[15px] text-slate-600">Làm trọn đề có tính giờ, nộp bài xem điểm và đáp án từng câu.</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />
          </a>
        </section>

        <section className="mt-10 md:mt-14" aria-label="Tra từ">
          <GlobalSearch />
        </section>

        <section className="mt-10 md:mt-14">
          <h2 className="text-2xl text-slate-900 md:text-[28px]">Chọn unit</h2>
          <p className="mt-1 text-[15px] text-slate-600">Mỗi unit có danh sách từ, flashcard, trắc nghiệm, ghép thẻ và gõ từ.</p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {UNITS.map((u) => (
              <UnitCard key={u.id} unit={u} current={u.id === last?.id} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
