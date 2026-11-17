import { ArrowRight, ChartColumn, ClipboardList, NotebookPen, PencilLine, Play } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { formatClock, useAllExams } from '../../lib/exam-ui';
import { toBank } from '../../lib/grade';
import { useProgress } from '../../lib/progress';
import { href } from '../../lib/router';
import { scoreHistory, typeAccuracy, weakestTypes } from '../../lib/stats';
import { QUESTION_TYPE_LABEL } from '../../types/exam';
import { Card } from '../common';

interface Item {
  key: string;
  icon: ReactNode;
  title: string;
  note?: string;
  href: string;
}

/** What to do today, most urgent first: an unfinished paper, due mistakes, the weakest type. */
export function Today() {
  const loaded = useAllExams();
  const { state } = useProgress();
  const items = useMemo((): Item[] | null => {
    if (loaded.status !== 'ready') return null;
    const exams = loaded.data;
    const out: Item[] = [];
    const byId = new Map(exams.map((e) => [e.id, e]));
    const unfinished = Object.values(state.attempts)
      .filter((a) => !a.submittedAt && !a.abandoned && byId.has(a.examId))
      .sort((a, b) => b.t - a.t)[0];
    if (unfinished) {
      out.push({ key: 'resume', icon: <Play className="h-5 w-5" />, title: `Làm tiếp: ${byId.get(unfinished.examId)!.title}`, note: `còn ${formatClock(unfinished.remainingMs ?? 0)}`, href: href.exam(unfinished.examId) });
    }
    const now = Date.now();
    const due = Object.values(state.questions).filter((q) => q.srs && q.srs.due <= now).length;
    if (due) out.push({ key: 'due', icon: <NotebookPen className="h-5 w-5" />, title: `Ôn ${due} câu đến hạn`, note: 'trong sổ lỗi sai', href: href.mistakes() });
    const weak = weakestTypes(typeAccuracy(toBank(exams), state.questions), 1)[0];
    if (weak) {
      out.push({ key: 'weak', icon: <PencilLine className="h-5 w-5" />, title: `Luyện ${QUESTION_TYPE_LABEL[weak.type].toLowerCase()}`, note: `dạng yếu nhất, đúng ${Math.round(weak.rate! * 100)}%`, href: href.practice(weak.type) });
    }
    const done = scoreHistory(exams, state.attempts).length;
    if (!unfinished) {
      out.push({ key: 'exam', icon: <ClipboardList className="h-5 w-5" />, title: done ? 'Làm thêm một đề thi thử' : 'Làm đề thi thử đầu tiên', note: done ? `đã nộp ${done} lần` : 'có tính giờ, chấm điểm ngay', href: href.exams() });
    }
    if (done) out.push({ key: 'stats', icon: <ChartColumn className="h-5 w-5" />, title: 'Xem thống kê', note: 'điểm qua các lần thi, dạng bài yếu', href: href.stats() });
    return out;
  }, [loaded, state.attempts, state.questions]);

  return (
    <section aria-labelledby="today-title">
      <h2 id="today-title" className="text-2xl text-slate-900 md:text-[28px]">
        Ôn thi HSG hôm nay
      </h2>
      <Card className="mt-4 divide-y divide-slate-100">
        {items === null ? (
          <div className="h-[132px]" aria-busy="true" />
        ) : (
          items.map((it, i) => (
            <a key={it.key} href={it.href} className="flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <span className={i === 0 ? 'text-indigo-600' : 'text-slate-500'}>{it.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-[16px] font-semibold text-slate-900">{it.title}</span>
                {it.note && <span className="block text-[14px] text-slate-600">{it.note}</span>}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
            </a>
          ))
        )}
      </Card>
    </section>
  );
}
