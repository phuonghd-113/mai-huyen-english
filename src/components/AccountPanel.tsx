import { CloudOff, LogOut, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useProgress, type SyncInfo } from '../lib/progress';
import { cx } from '../lib/ui';
import { Button, Card, Segmented } from './common';

function timeAgo(ms?: number) {
  if (!ms) return '';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  return new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function syncLabel(sync: SyncInfo): string {
  switch (sync.status) {
    case 'syncing':
      return 'Đang đồng bộ…';
    case 'synced':
      return `Đã đồng bộ ${timeAgo(sync.lastSyncAt)}`;
    case 'offline':
      return 'Offline, sẽ đồng bộ khi có mạng';
    case 'error':
      return 'Chưa đồng bộ được';
    default:
      return 'Chỉ lưu trên máy này';
  }
}

export function SyncDot({ status }: { status: SyncInfo['status'] }) {
  return (
    <span
      className={cx(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        status === 'synced' && 'bg-indigo-600',
        status === 'syncing' && 'animate-pulse bg-indigo-400',
        status === 'offline' && 'bg-slate-400',
        status === 'error' && 'bg-orange-500',
        status === 'off' && 'bg-slate-300',
      )}
      aria-hidden
    />
  );
}

export function AccountPanel() {
  const { sync, signIn, signOut, syncNow, state } = useProgress();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const localCount = Object.values(state.words).filter((w) => w.status || w.starred).length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signIn(mode, username, password);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đăng nhập được.');
    } finally {
      setPending(false);
    }
  };

  if (sync.account) {
    return (
      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg text-slate-900">Tài khoản</h2>
            <p className="text-[15px] text-slate-700">
              Đang đăng nhập: <b className="font-semibold text-slate-900">{sync.account.username}</b>
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-[15px] text-slate-700" role="status">
          <SyncDot status={sync.status} /> {syncLabel(sync)}
        </p>
        {sync.message && <p className="rounded-xl bg-orange-50 px-3 py-2 text-[15px] text-orange-800">{sync.message}</p>}
        <p className="text-[15px] text-slate-600">Đăng nhập cùng tên này trên điện thoại, máy tính bảng hay máy ở trường: tiến độ tự đồng bộ giữa các máy.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
            <RefreshCw className="h-4 w-4" /> Đồng bộ ngay
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm('Đăng xuất? Tiến độ đã lưu trên tài khoản, máy này sẽ được xóa trắng để người khác dùng.')) void signOut();
            }}
          >
            <LogOut className="h-4 w-4" /> Đăng xuất
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-lg text-slate-900">Tài khoản</h2>
        <p className="text-[15px] text-slate-600">Đăng nhập để học tiếp trên mọi máy. Không cần email.</p>
      </div>
      {sync.message && (
        <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-[15px] text-orange-800">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" /> {sync.message}
        </p>
      )}
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        className="w-full"
        label="Đăng nhập hoặc tạo tài khoản"
        options={[
          { value: 'login', label: 'Đăng nhập' },
          { value: 'register', label: 'Tạo tài khoản' },
        ]}
      />
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[15px] font-medium text-slate-800">Tên đăng nhập</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            minLength={3}
            maxLength={24}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-100"
          />
          {mode === 'register' && <span className="mt-1 block text-[13px] text-slate-600">3–24 ký tự: chữ không dấu, số, dấu chấm, gạch dưới. Ví dụ: huyen.8a2</span>}
        </label>
        <label className="block">
          <span className="mb-1 block text-[15px] font-medium text-slate-800">Mật khẩu</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            maxLength={72}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-100"
          />
          {mode === 'register' && <span className="mt-1 block text-[13px] text-slate-600">Ít nhất 6 ký tự. Hãy ghi lại: chưa có cách lấy lại mật khẩu.</span>}
        </label>
        {error && (
          <p className="text-[15px] font-medium text-red-700" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Đang gửi…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </Button>
        {localCount > 0 && <p className="text-[13px] text-slate-600">{localCount} từ bạn đã học trên máy này sẽ được gộp vào tài khoản.</p>}
      </form>
    </Card>
  );
}
