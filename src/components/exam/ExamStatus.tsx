import { FileX, LoaderCircle } from 'lucide-react';
import { href } from '../../lib/router';
import { EmptyState } from '../common';
import { MobileHeader } from '../Layout';

export function ExamLoading() {
  return (
    <>
      <MobileHeader title="Thi thử" back={href.exams()} />
      <main className="mx-auto flex w-full max-w-3xl justify-center p-10 text-slate-400" aria-busy="true">
        <LoaderCircle className="h-8 w-8 animate-spin" aria-label="Đang tải đề" />
      </main>
    </>
  );
}

export function ExamMissing({ failed, title = 'Không tìm thấy đề' }: { failed?: boolean; title?: string }) {
  return (
    <>
      <MobileHeader title="Thi thử" back={href.exams()} />
      <main className="mx-auto w-full max-w-3xl p-4 md:p-8">
        <EmptyState icon={<FileX className="h-12 w-12" />} title={failed ? 'Không tải được đề' : title}>
          {failed ? 'Kiểm tra kết nối mạng rồi tải lại trang. ' : ''}
          <a className="font-semibold text-indigo-600" href={href.exams()}>
            Về danh sách đề
          </a>
        </EmptyState>
      </main>
    </>
  );
}
