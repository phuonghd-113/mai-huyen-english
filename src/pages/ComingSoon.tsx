import { Hammer } from 'lucide-react';
import { EmptyState } from '../components/common';
import { MobileHeader } from '../components/Layout';
import { href } from '../lib/router';

/** Routes reserved for the exam features that later steps fill in. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <MobileHeader title={title} back={href.home()} />
      <main className="mx-auto w-full max-w-3xl p-4 md:p-8">
        <EmptyState icon={<Hammer className="h-12 w-12" />} title={`${title}: đang xây dựng`}>
          Phần này sẽ có trong bản cập nhật tới.{' '}
          <a className="font-semibold text-indigo-600" href={href.home()}>
            Về trang chủ
          </a>
        </EmptyState>
      </main>
    </>
  );
}
