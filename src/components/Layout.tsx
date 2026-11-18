import { ArrowLeft, ChartColumn, ClipboardList, Flame, House, LibraryBig, NotebookPen, PencilLine, Settings } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { ALL_WORDS, UNITS } from '../data';
import { isHard, useProgress } from '../lib/progress';
import { href, type Route } from '../lib/router';
import { cx } from '../lib/ui';
import { SyncDot, syncLabel } from './AccountPanel';
import { UpdatePrompt } from './UpdatePrompt';
import { ProgressBar } from './common';

const isExamRoute = (r: Route) => r.name === 'exams' || r.name === 'exam' || r.name === 'exam-review';

/** Mistakes due for review; counted from progress alone so the badge does not load the papers. */
function useDueCount() {
  const { state } = useProgress();
  return useMemo(() => {
    const now = Date.now();
    return Object.values(state.questions).filter((q) => q.srs && q.srs.due <= now).length;
  }, [state.questions]);
}

function useHardCount() {
  const { state } = useProgress();
  return useMemo(() => ALL_WORDS.filter((w) => isHard(state.words[w.id])).length, [state.words]);
}

function Sidebar({ route }: { route: Route }) {
  const { masteredCount, sync } = useProgress();
  const hard = useHardCount();
  const due = useDueCount();
  const activeUnit = route.name === 'unit' ? route.unitId : null;
  const navItem = (active: boolean) =>
    cx('flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors', active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100');

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 lg:w-72 flex-col border-r border-slate-200 bg-white md:flex">
      <a href={href.home()} className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 font-display text-lg font-semibold text-slate-50">B1</span>
        <span>
          <span className="block font-display text-lg font-semibold leading-tight text-slate-900">Ôn HSG Anh 8</span>
          <span className="block text-[13px] text-slate-500">Lớp 8 · từ vựng B1</span>
        </span>
      </a>
      <nav className="space-y-1 px-3" aria-label="Điều hướng chính">
        <a href={href.home()} className={navItem(route.name === 'home')}>
          <House className="h-[18px] w-[18px]" /> Trang chủ
        </a>
        <a href={href.exams()} className={navItem(isExamRoute(route))}>
          <ClipboardList className="h-[18px] w-[18px]" /> Thi thử
        </a>
        <a href={href.practice()} className={navItem(route.name === 'practice')}>
          <PencilLine className="h-[18px] w-[18px]" /> Luyện theo dạng
        </a>
        <a href={href.mistakes()} className={navItem(route.name === 'mistakes')}>
          <NotebookPen className="h-[18px] w-[18px]" /> Sổ lỗi sai
          {due > 0 && <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[13px] font-semibold tabular text-orange-800">{due}</span>}
        </a>
        <a href={href.stats()} className={navItem(route.name === 'stats')}>
          <ChartColumn className="h-[18px] w-[18px]" /> Thống kê
        </a>
        <a href={href.review()} className={navItem(route.name === 'review')}>
          <Flame className="h-[18px] w-[18px]" /> Ôn tập từ khó
          {hard > 0 && <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[13px] font-semibold tabular text-orange-800">{hard}</span>}
        </a>
      </nav>
      <div className="mt-6 px-6 pb-2 text-[13px] font-medium text-slate-500">14 unit trong sách</div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3" aria-label="Danh sách Unit">
        {UNITS.map((u) => {
          const pct = masteredCount(u.words) / u.words.length;
          return (
            <a key={u.id} href={href.unit(u.id)} className={cx('flex items-center gap-3 rounded-xl px-3 py-2 transition-colors', activeUnit === u.id ? 'bg-slate-100' : 'hover:bg-slate-50')} aria-current={activeUnit === u.id ? 'page' : undefined}>
              <span className={cx('w-7 shrink-0 font-display text-lg font-semibold tabular', activeUnit === u.id ? 'text-slate-900' : 'text-slate-400')}>{String(u.unitNumber).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-slate-800">{u.title}</span>
                <ProgressBar value={pct} className="mt-1 h-1" />
              </span>
            </a>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <a href={href.settings()} className={navItem(route.name === 'settings')}>
          <Settings className="h-[18px] w-[18px]" /> Cài đặt
        </a>
        <a href={href.settings()} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] text-slate-600 hover:text-slate-900">
          <SyncDot status={sync.status} />
          <span className="truncate">{sync.account ? `${sync.account.username} · ${syncLabel(sync)}` : 'Chưa đăng nhập · chỉ lưu trên máy này'}</span>
        </a>
      </div>
    </aside>
  );
}

function BottomNav({ route }: { route: Route }) {
  const due = useDueCount();
  const item = (active: boolean) => cx('relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[13px] font-medium', active ? 'text-slate-900' : 'text-slate-500');
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Điều hướng chính">
      <a href={href.home()} className={item(route.name === 'home')}>
        <House className="h-5 w-5" /> Trang chủ
      </a>
      <a href={href.exams()} className={item(isExamRoute(route))}>
        <ClipboardList className="h-5 w-5" /> Thi thử
      </a>
      <a href={href.practice()} className={item(route.name === 'practice' || route.name === 'mistakes' || route.name === 'review' || route.name === 'stats')}>
        <PencilLine className="h-5 w-5" /> Luyện tập
        {due > 0 && <span className="absolute right-[calc(50%-22px)] top-1 rounded-full bg-orange-600 px-1.5 text-[11px] font-semibold leading-4 text-white">{due > 99 ? '99+' : due}</span>}
      </a>
      <a href={href.units()} className={item(route.name === 'units' || route.name === 'unit')}>
        <LibraryBig className="h-5 w-5" /> Unit
      </a>
      <a href={href.settings()} className={item(route.name === 'settings')}>
        <Settings className="h-5 w-5" /> Cài đặt
      </a>
    </nav>
  );
}

export function MobileHeader({ title, back, right }: { title: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-slate-200 bg-white px-2 md:hidden">
      {back ? (
        <a href={back} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Quay lại">
          <ArrowLeft className="h-5 w-5" />
        </a>
      ) : (
        <span className="ml-2 mr-1 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-display text-sm font-semibold text-slate-50">B1</span>
      )}
      <div className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold text-slate-900">{title}</div>
      {right}
    </header>
  );
}

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { storageOk } = useProgress();
  return (
    <div className="flex min-h-dvh">
      <Sidebar route={route} />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
        {!storageOk && (
          <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-800">Trình duyệt đang chặn bộ nhớ: tiến độ sẽ không được lưu sau khi đóng trang.</div>
        )}
        {children}
      </div>
      <BottomNav route={route} />
      <UpdatePrompt />
    </div>
  );
}
