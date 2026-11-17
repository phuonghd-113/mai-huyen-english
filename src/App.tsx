import { Layout, MobileHeader } from './components/Layout';
import { EmptyState } from './components/common';
import { UNIT_BY_ID } from './data';
import { ProgressProvider } from './lib/progress';
import { href, useRoute } from './lib/router';
import { ComingSoon } from './pages/ComingSoon';
import { Dashboard } from './pages/Dashboard';
import { ExamPage } from './pages/ExamPage';
import { ExamReviewPage } from './pages/ExamReviewPage';
import { ExamsPage } from './pages/ExamsPage';
import { MistakesPage } from './pages/MistakesPage';
import { PracticePage } from './pages/PracticePage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnitPage } from './pages/UnitPage';
import { UnitsPage } from './pages/UnitsPage';
import { SearchX } from 'lucide-react';

function NotFound() {
  return (
    <>
      <MobileHeader title="Không tìm thấy" back={href.home()} />
      <main className="mx-auto w-full max-w-3xl p-4 md:p-8">
        <EmptyState icon={<SearchX className="h-12 w-12" />} title="Không tìm thấy trang">
          <a className="font-semibold text-indigo-600" href={href.home()}>
            Về trang chủ
          </a>
        </EmptyState>
      </main>
    </>
  );
}

function Routes() {
  const route = useRoute();
  let page;
  switch (route.name) {
    case 'home':
      page = <Dashboard />;
      break;
    case 'units':
      page = <UnitsPage />;
      break;
    case 'unit': {
      const unit = UNIT_BY_ID.get(route.unitId);
      page = unit ? <UnitPage key={unit.id} unit={unit} mode={route.mode} /> : <NotFound />;
      break;
    }
    case 'review':
      page = <ReviewPage mode={route.mode} />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'exams':
      page = <ExamsPage />;
      break;
    case 'exam':
      page = <ExamPage key={route.examId} examId={route.examId} />;
      break;
    case 'exam-review':
      page = <ExamReviewPage key={route.attemptId} examId={route.examId} attemptId={route.attemptId} />;
      break;
    case 'practice':
      page = <PracticePage key={route.type ?? 'hub'} type={route.type} />;
      break;
    case 'mistakes':
      page = <MistakesPage />;
      break;
    case 'stats':
      page = <ComingSoon title="Thống kê" />;
      break;
    case 'admin-exam':
      page = <ComingSoon title="Xem trước đề" />;
      break;
    default:
      page = <NotFound />;
  }
  return <Layout route={route}>{page}</Layout>;
}

export default function App() {
  return (
    <ProgressProvider>
      <Routes />
    </ProgressProvider>
  );
}
