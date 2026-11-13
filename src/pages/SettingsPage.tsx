import { AlertTriangle, Download, RotateCcw, Upload, Volume2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Card, Segmented } from '../components/common';
import { MobileHeader } from '../components/Layout';
import { AccountPanel } from '../components/AccountPanel';
import { ALL_WORDS } from '../data';
import { sanitizeState, useProgress } from '../lib/progress';
import { href } from '../lib/router';
import { pickVoice, speak, speechSupported, useVoices } from '../lib/speech';
import type { Accent } from '../types/vocab';

export function SettingsPage() {
  const { state, updateSettings, replaceAll, reset, sync } = useProgress();
  const { accent, rate, autoSpeak } = state.settings;
  const voices = useVoices();
  const { voice, exact } = pickVoice(accent);
  const englishCount = voices.filter((v) => v.lang.toLowerCase().startsWith('en')).length;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tien-do-b1-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const next = sanitizeState(parsed);
      const known = Object.keys(next.words).filter((id) => ALL_WORDS.some((w) => w.id === id)).length;
      if (!window.confirm(`Nhập tiến độ từ file (${known} từ có dữ liệu)? Tiến độ hiện tại sẽ bị thay thế.`)) return;
      replaceAll(next);
      setMsg(`Đã nhập tiến độ: ${known} từ.`);
    } catch {
      setMsg('File không hợp lệ.');
    }
  };

  return (
    <>
      <MobileHeader title="Cài đặt" back={href.home()} />
      <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 md:px-8 md:py-8">
        <h1 className="hidden text-2xl text-slate-900 md:block">Cài đặt</h1>

        <AccountPanel />

        <Card className="space-y-5 p-5">
          <h2 className="text-base font-bold text-slate-900">Phát âm</h2>
          {!speechSupported ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Trình duyệt này không hỗ trợ đọc phát âm. Hãy thử Chrome, Edge hoặc Safari bản mới.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">Giọng đọc</span>
                <Segmented<Accent>
                  value={accent}
                  onChange={(v) => updateSettings({ accent: v })}
                  label="Giọng đọc"
                  options={[
                    { value: 'en-GB', label: 'Anh-Anh' },
                    { value: 'en-US', label: 'Anh-Mỹ' },
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">Tốc độ</span>
                <Segmented<number>
                  value={rate}
                  onChange={(v) => updateSettings({ rate: v })}
                  label="Tốc độ đọc"
                  options={[
                    { value: 0.7, label: 'Chậm' },
                    { value: 0.9, label: 'Vừa' },
                    { value: 1.05, label: 'Nhanh' },
                  ]}
                />
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-slate-700">Tự phát âm khi trả lời</span>
                  <span className="block text-[13px] text-slate-500">Trong Trắc nghiệm và Gõ từ</span>
                </span>
                <input type="checkbox" checked={autoSpeak} onChange={(e) => updateSettings({ autoSpeak: e.target.checked })} className="h-5 w-5 accent-indigo-600" />
              </label>
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                {voice ? (
                  <>
                    Đang dùng: <b>{voice.name}</b> ({voice.lang}){!voice.localService && ' · cần mạng'}
                    {!exact && <span className="mt-1 block text-amber-700">Máy không có giọng {accent}, đang dùng giọng tiếng Anh khác.</span>}
                  </>
                ) : voices.length === 0 ? (
                  'Đang tải danh sách giọng…'
                ) : (
                  <span className="text-amber-700">Không tìm thấy giọng tiếng Anh trên máy ({voices.length} giọng khác). Hãy cài thêm giọng English trong cài đặt hệ thống.</span>
                )}
                {englishCount > 0 && <span className="mt-1 block text-[13px] text-slate-500">{englishCount} giọng tiếng Anh khả dụng</span>}
              </div>
              <Button variant="secondary" onClick={() => speak('Welcome to Destination B1 vocabulary', { accent, rate })}>
                <Volume2 className="h-4 w-4" /> Nghe thử
              </Button>
            </>
          )}
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-base font-bold text-slate-900">Tiến độ học</h2>
          <p className="text-sm text-slate-500">{sync.account ? 'Tiến độ được lưu trên máy này và đồng bộ với tài khoản. Xuất file để giữ một bản sao lưu riêng.' : 'Tiến độ đang chỉ lưu trong trình duyệt của máy này. Đăng nhập ở trên, hoặc dùng Xuất/Nhập file, để chuyển sang máy khác.'}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportData}>
              <Download className="h-4 w-4" /> Xuất file
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Nhập file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importData(f);
                e.target.value = '';
              }}
            />
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                if (window.confirm(sync.account ? 'Xóa toàn bộ tiến độ (đã thuộc, gắn sao, điểm cao) trên tài khoản và mọi máy? Không thể hoàn tác.' : 'Xóa toàn bộ tiến độ (đã thuộc, gắn sao, điểm cao)? Không thể hoàn tác.')) {
                  reset();
                  setMsg('Đã xóa tiến độ.');
                }
              }}
            >
              <RotateCcw className="h-4 w-4" /> Xóa tiến độ
            </Button>
          </div>
          {msg && <p className="text-sm font-semibold text-indigo-700">{msg}</p>}
        </Card>

        <p className="px-1 text-center text-[13px] text-slate-500">Dữ liệu: Destination B1 Vocabulary (biên soạn bởi karlnguyenn × duonglinh), đã chuẩn hóa · {ALL_WORDS.length} mục</p>
      </main>
    </>
  );
}
