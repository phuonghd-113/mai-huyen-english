import { CircleCheck, RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY = 60 * 60 * 1000;

let reloading = false;

/**
 * Activate the waiting version, then reload once it controls the page. The plugin's own reload hangs on a
 * workbox-window event that does not fire when the browser itself found the update (the usual case),
 * so the standard `controllerchange` event does the reload.
 */
function applyUpdate(update: (reload?: boolean) => Promise<void>) {
  navigator.serviceWorker?.addEventListener(
    'controllerchange',
    () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    },
    { once: true },
  );
  void update(true);
}

/**
 * The service worker precaches the app and all papers. A new version is installed in the background
 * but only takes over when the student taps "Cập nhật" (never in the middle of a paper).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // tabs left open for days still learn about new versions
      if (reg) setInterval(() => void reg.update().catch(() => undefined), CHECK_EVERY);
    },
  });

  if (!needRefresh && !offlineReady) return null;
  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };
  return (
    <div className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md md:bottom-6 md:left-auto md:right-6 md:mx-0" role="status">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 pl-4 shadow-lg">
        {needRefresh ? <RefreshCw className="h-5 w-5 shrink-0 text-indigo-600" /> : <CircleCheck className="h-5 w-5 shrink-0 text-indigo-600" />}
        <p className="min-w-0 flex-1 text-[15px] text-slate-800">{needRefresh ? 'Có bản cập nhật mới của app.' : 'App đã lưu về máy, dùng được cả khi không có mạng.'}</p>
        {needRefresh && (
          <button type="button" onClick={() => applyUpdate(updateServiceWorker)} className="btn-step min-h-[40px] shrink-0 rounded-xl bg-indigo-600 px-4 text-[15px] font-semibold text-white hover:bg-indigo-700">
            Cập nhật
          </button>
        )}
        <button type="button" onClick={close} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Đóng">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
