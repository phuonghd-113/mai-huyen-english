import { ArrowRight, ChartColumn, LoaderCircle } from 'lucide-react';
import { useMemo } from 'react';
import { Card, EmptyState } from '../components/common';
import { MobileHeader } from '../components/Layout';
import { ScoreChart } from '../components/stats/ScoreChart';
import { TypeBars } from '../components/stats/TypeBars';
import { formatDate, formatScore, useAllExams } from '../lib/exam-ui';
import { toBank } from '../lib/grade';
import { useProgress } from '../lib/progress';
import { href } from '../lib/router';
import { chartScale, MIN_ANSWERS, scoreHistory, totals, typeAccuracy, weakestTypes } from '../lib/stats';
import { QUESTION_TYPE_LABEL, type Exam } from '../types/exam';

export function StatsPage() {
  const loaded = useAllExams();
  return (
    <>
      <MobileHeader title="Thống kê" back={href.practice()} />
      <main className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6 md:px-8 md:pt-12">
        <h1 className="text-[32px] leading-tight text-slate-900 md:text-[44px]">Thống kê</h1>
        {loaded.status === 'loading' && (
          <div className="flex justify-center p-10 text-slate-400">
            <LoaderCircle className="h-8 w-8 animate-spin" aria-label="Đang tải" />
          </div>
        )}
        {loaded.status === 'error' && (
          <div className="mt-6">
            <EmptyState icon={<ChartColumn className="h-12 w-12" />} title="Không tải được dữ liệu đề">
              Kiểm tra kết nối mạng rồi tải lại trang.
            </EmptyState>
          </div>
        )}
        {loaded.status === 'ready' && <Stats exams={loaded.data} />}
      </main>
    </>
  );
}

function Stats({ exams }: { exams: Exam[] }) {
  const { state } = useProgress();
  const bank = useMemo(() => toBank(exams), [exams]);
  const points = useMemo(() => scoreHistory(exams, state.attempts), [exams, state.attempts]);
  const acc = useMemo(() => typeAccuracy(bank, state.questions), [bank, state.questions]);
  const t = useMemo(() => totals(points, state.questions, Date.now()), [points, state.questions]);
  const weak = weakestTypes(acc);
  const scale = chartScale(points);
  const last = points[points.length - 1];

  return (
    <>
      <p className="mt-2 max-w-2xl text-[16px] text-slate-600">Điểm các lần thi thử và độ chắc của từng dạng bài, tính trên mọi câu đã làm trong thi thử và luyện tập.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Đề đã làm" value={String(t.examsDone)} />
        <Tile label="Điểm lần gần nhất" value={last ? `${formatScore(last.score)}/${formatScore(last.max)}` : '—'} />
        <Tile label="Câu đã làm" value={String(t.questionsSeen)} note={t.answers ? `đúng ${Math.round((t.right / t.answers) * 100)}% số lượt` : undefined} />
        <Tile label="Trong sổ lỗi sai" value={String(t.inNotebook)} note={t.dueNow ? `${t.dueNow} câu đến hạn` : undefined} href={href.mistakes()} />
      </div>

      <section className="mt-10">
        <h2 className="text-2xl text-slate-900">Điểm thi thử</h2>
        {points.length === 0 ? (
          <p className="mt-2 text-[16px] text-slate-600">
            Chưa nộp đề nào.{' '}
            <a href={href.exams()} className="font-semibold text-indigo-700">
              Làm một đề thi thử
            </a>
          </p>
        ) : (
          <>
            <p className="mt-1 text-[15px] text-slate-600">{points.every((p) => p.max === scale) ? `Thang ${scale} điểm, theo thứ tự các lần nộp.` : `Quy về thang ${scale} vì các đề có thang điểm khác nhau.`}</p>
            <Card className="mt-4 p-3 md:p-5">
              <ScoreChart points={points} scale={scale} />
            </Card>
            <details className="mt-2">
              <summary className="cursor-pointer select-none py-2 text-[15px] font-medium text-slate-700">Xem dạng bảng</summary>
              <Card className="overflow-hidden">
                <table className="w-full text-left text-[15px]">
                  <thead className="text-[13px] text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 font-medium md:px-4">Ngày nộp</th>
                      <th className="px-3 py-2 font-medium md:px-4">Đề</th>
                      <th className="px-3 py-2 text-right font-medium md:px-4">Điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...points].reverse().map((p) => (
                      <tr key={p.attemptId}>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600 md:px-4">{formatDate(p.submittedAt)}</td>
                        <td className="px-3 py-2 md:px-4">
                          <a href={href.examReview(p.examId, p.attemptId)} className="text-slate-800 hover:text-indigo-700">
                            {p.title}
                          </a>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums md:px-4">
                          <b className="font-semibold text-slate-900">{formatScore(p.score)}</b>
                          <span className="text-slate-500">/{formatScore(p.max)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </details>
          </>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl text-slate-900">Tỉ lệ đúng theo dạng bài</h2>
        <p className="mt-1 text-[15px] text-slate-600">Dạng yếu nhất ở trên. Một dạng cần ít nhất {MIN_ANSWERS} lượt làm mới tính tỉ lệ. Chạm vào một dạng để luyện.</p>
        {weak.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {weak.map((w) => (
              <a key={w.type} href={href.practice(w.type)} className="lift flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-slate-500">Cần luyện thêm</span>
                  <span className="block truncate font-display text-[17px] font-semibold text-slate-900">{QUESTION_TYPE_LABEL[w.type]}</span>
                  <span className="block text-[14px] tabular-nums text-slate-600">đúng {Math.round(w.rate! * 100)}%</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[14px] font-semibold text-indigo-700">
                  Luyện ngay <ArrowRight className="h-4 w-4" />
                </span>
              </a>
            ))}
          </div>
        )}
        <Card className="mt-4 p-2 md:p-4">
          {acc.length ? <TypeBars rows={acc} /> : <p className="p-2 text-[15px] text-slate-600">Chưa có câu hỏi.</p>}
        </Card>
      </section>
    </>
  );
}

function Tile({ label, value, note, href: link }: { label: string; value: string; note?: string; href?: string }) {
  const body = (
    <>
      <span className="block text-[14px] text-slate-600">{label}</span>
      <span className="mt-1 block font-display text-[28px] font-semibold leading-tight text-slate-900">{value}</span>
      {note && <span className="block text-[13px] text-slate-500">{note}</span>}
    </>
  );
  const cls = 'block rounded-2xl border border-slate-200 bg-white p-4';
  return link ? (
    <a href={link} className={`${cls} lift`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}
