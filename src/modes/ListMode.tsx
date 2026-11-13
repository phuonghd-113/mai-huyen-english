import { Eye, EyeOff, Search, SearchX } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { CategoryBadge, EmptyState, MasteredButton, PosTag, Segmented, SpeakButton, StarButton } from '../components/common';
import { UNIT_BY_ID } from '../data';
import { useProgress, wordStatus } from '../lib/progress';
import { foldVi } from '../lib/text';
import { cx } from '../lib/ui';
import type { VocabCategory, VocabItem } from '../types/vocab';

type CatFilter = 'all' | VocabCategory;
type StatusFilter = 'all' | 'new' | 'learning' | 'mastered' | 'starred';
type Hide = 'none' | 'meaning' | 'term';

function Hidden({ hidden, onReveal, children, label }: { hidden: boolean; onReveal: () => void; children: React.ReactNode; label: string }) {
  if (!hidden) return <>{children}</>;
  return (
    <button type="button" onClick={onReveal} className="w-full rounded-lg bg-slate-100 px-3 py-1.5 text-left text-sm font-medium text-slate-400 hover:bg-slate-200" aria-label={`Hiện ${label}`}>
      Chạm để xem {label}
    </button>
  );
}

export function ListMode({ words, showUnit }: { words: VocabItem[]; showUnit?: boolean }) {
  const { state } = useProgress();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q.trim());
  const [cat, setCat] = useState<CatFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [hide, setHide] = useState<Hide>('none');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const en = dq.toLowerCase();
    const vi = foldVi(dq);
    return words.filter((w) => {
      if (cat !== 'all' && w.category !== cat) return false;
      const p = state.words[w.id];
      if (status === 'starred' ? !p?.starred : status !== 'all' && wordStatus(p) !== status) return false;
      if (dq && !w.term.toLowerCase().includes(en) && !foldVi(w.meaning).includes(vi)) return false;
      return true;
    });
  }, [words, dq, cat, status, state.words]);

  const setHideMode = (h: Hide) => {
    setHide(h);
    setRevealed(new Set());
  };
  const reveal = (id: string) => setRevealed((s) => new Set(s).add(id));
  const termHidden = (id: string) => hide === 'term' && !revealed.has(id);
  const meaningHidden = (id: string) => hide === 'meaning' && !revealed.has(id);

  return (
    <div className="space-y-3">
      <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3">
        <label className="relative block">
          <span className="sr-only">Tìm trong danh sách</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm từ hoặc nghĩa…"
            type="search"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
        </label>
        <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
          <Segmented<CatFilter>
            value={cat}
            onChange={setCat}
            label="Lọc theo nhóm"
            className="shrink-0"
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'word', label: 'Từ đơn' },
              { value: 'phrasal-verb', label: 'Phrasal verb' },
              { value: 'phrase', label: 'Cụm từ' },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
            aria-label="Lọc theo trạng thái"
          >
            <option value="all">Mọi trạng thái</option>
            <option value="new">Chưa học</option>
            <option value="learning">Đang học</option>
            <option value="mastered">Đã thuộc</option>
            <option value="starred">⭐ Gắn sao</option>
          </select>
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => setHideMode(hide === 'term' ? 'none' : 'term')}
              className={cx('inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition', hide === 'term' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
              aria-pressed={hide === 'term'}
            >
              {hide === 'term' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} Che từ
            </button>
            <button
              type="button"
              onClick={() => setHideMode(hide === 'meaning' ? 'none' : 'meaning')}
              className={cx('inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition', hide === 'meaning' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
              aria-pressed={hide === 'meaning'}
            >
              {hide === 'meaning' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} Che nghĩa
            </button>
          </div>
        </div>
      </div>

      <p className="px-1 text-[13px] font-semibold text-slate-500">
        {filtered.length}/{words.length} mục
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon={<SearchX className="h-10 w-10" />} title="Không có mục nào">
          Thử đổi bộ lọc hoặc từ khóa tìm kiếm.
        </EmptyState>
      ) : (
        <>
          {/* Desktop/tablet: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[13px] font-medium text-slate-600">
                <tr>
                  <th className="w-12 px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3">Từ vựng</th>
                  <th className="px-3 py-3">Phiên âm</th>
                  <th className="px-3 py-3">Nghĩa</th>
                  <th className="w-36 px-3 py-3 text-right">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((w) => (
                  <tr key={w.id} className="align-top hover:bg-slate-50/60">
                    <td className="px-3 py-3 text-center text-[13px] font-semibold text-slate-400">
                      {showUnit ? <span title={UNIT_BY_ID.get(w.unitId)?.title}>U{String(w.unitNumber).padStart(2, '0')}</span> : w.stt}
                    </td>
                    <td className="px-3 py-3">
                      <Hidden hidden={termHidden(w.id)} onReveal={() => reveal(w.id)} label="từ">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-[17px] font-semibold text-slate-900">{w.term}</span>
                          <PosTag pos={w.pos} />
                        </div>
                      </Hidden>
                      <div className="mt-1">
                        <CategoryBadge category={w.category} />
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[13px] text-slate-500">{termHidden(w.id) ? '' : w.ipa}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <Hidden hidden={meaningHidden(w.id)} onReveal={() => reveal(w.id)} label="nghĩa">
                        <div>{w.meaning}</div>
                        {w.note && <div className="mt-0.5 text-[13px] text-slate-500">{w.note}</div>}
                      </Hidden>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end">
                        <SpeakButton word={w} />
                        <StarButton id={w.id} />
                        <MasteredButton id={w.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((w) => (
              <li key={w.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-start gap-1">
                  <span className="mt-1 w-7 shrink-0 text-[13px] font-semibold text-slate-400">{showUnit ? `U${String(w.unitNumber).padStart(2, '0')}` : w.stt}</span>
                  <div className="min-w-0 flex-1">
                    <Hidden hidden={termHidden(w.id)} onReveal={() => reveal(w.id)} label="từ">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-lg font-semibold text-slate-900">{w.term}</span>
                        <PosTag pos={w.pos} />
                      </div>
                      {w.ipa && <div className="font-mono text-[13px] text-slate-500">{w.ipa}</div>}
                    </Hidden>
                  </div>
                  <SpeakButton word={w} />
                </div>
                <div className="mt-2 pl-8">
                  <Hidden hidden={meaningHidden(w.id)} onReveal={() => reveal(w.id)} label="nghĩa">
                    <div className="text-[15px] text-slate-700">{w.meaning}</div>
                    {w.note && <div className="mt-0.5 text-[13px] text-slate-500">{w.note}</div>}
                  </Hidden>
                </div>
                <div className="mt-1 flex items-center justify-between pl-8">
                  <CategoryBadge category={w.category} />
                  <div className="flex">
                    <StarButton id={w.id} />
                    <MasteredButton id={w.id} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
