import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ProgressState, ScopeScore, Settings, VocabItem, WordProgress, WordStatus } from '../types/vocab';
import { api, ApiError, loadAccount, OfflineError, saveAccount, type Account } from './api';
import { emptyState, mergeStates, sanitizeState, stateKey } from './state';

export { sanitizeState } from './state';

const KEY = 'b1vocab:v1';
const PUSH_DELAY = 1500;

function load(): ProgressState {
  try {
    const s = localStorage.getItem(KEY);
    return s ? sanitizeState(JSON.parse(s)) : emptyState();
  } catch {
    return emptyState();
  }
}

export function wordStatus(p: WordProgress | undefined): WordStatus {
  return p?.status ?? 'new';
}

export function isHard(p: WordProgress | undefined): boolean {
  if (!p) return false;
  if (p.starred) return true;
  if (p.status === 'learning') return true;
  return (p.wrong ?? 0) > 0 && p.status !== 'mastered';
}

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncInfo {
  account: Account | null;
  status: SyncStatus;
  lastSyncAt?: number;
  message?: string;
}

interface ProgressApi {
  state: ProgressState;
  storageOk: boolean;
  sync: SyncInfo;
  get: (id: string) => WordProgress | undefined;
  setStatus: (id: string, status: WordStatus) => void;
  toggleStar: (id: string) => void;
  recordAnswer: (id: string, correct: boolean) => void;
  updateScore: (scope: string, patch: (prev: ScopeScore) => ScopeScore) => void;
  touchUnit: (unitId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (next: ProgressState) => void;
  reset: () => void;
  masteredCount: (words: VocabItem[]) => number;
  signIn: (mode: 'login' | 'register', username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<ProgressApi | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(load);
  const [storageOk, setStorageOk] = useState(true);
  const [sync, setSync] = useState<SyncInfo>(() => {
    const account = loadAccount();
    return { account, status: account ? 'syncing' : 'off' };
  });
  const first = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;
  const accountRef = useRef(sync.account);
  accountRef.current = sync.account;
  /** bumps on every local edit; a push only clears "dirty" if no edit happened while it was in flight */
  const editSeq = useRef(0);
  const pushedSeq = useRef(0);
  const pushTimer = useRef<number>();
  const busy = useRef<Promise<void> | null>(null);

  // ---- local persistence
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
  }, [state]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          setState(sanitizeState(JSON.parse(e.newValue)));
        } catch {
          /* ignore */
        }
      }
      if (e.key === 'b1vocab:account') setSync((s) => ({ ...s, account: loadAccount(), status: loadAccount() ? s.status : 'off' }));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ---- sync with the server
  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      saveAccount(null);
      setSync({ account: null, status: 'error', message: e.message });
    } else if (e instanceof OfflineError) {
      setSync((s) => ({ ...s, status: 'offline', message: 'Đang offline. Tiến độ vẫn được lưu trên máy và sẽ đồng bộ khi có mạng.' }));
    } else {
      setSync((s) => ({ ...s, status: 'error', message: e instanceof Error ? e.message : 'Không đồng bộ được.' }));
    }
  }, []);

  /** Merge the server copy into ours, then send back anything the server lacked. One run at a time. */
  const runSync = useCallback(
    async (direction: 'pull' | 'push') => {
      const account = accountRef.current;
      if (!account) return;
      if (busy.current) await busy.current.catch(() => undefined);
      const job = (async () => {
        setSync((s) => ({ ...s, status: 'syncing' }));
        const seqAtStart = editSeq.current;
        let server: ProgressState;
        if (direction === 'pull') {
          server = sanitizeState((await api.getProgress(account.token)).state);
          const merged = mergeStates(stateRef.current, server);
          if (stateKey(merged) !== stateKey(stateRef.current)) setState(merged);
          stateRef.current = merged;
          if (stateKey(merged) !== stateKey(server)) server = sanitizeState((await api.putProgress(account.token, merged)).state);
        } else {
          server = sanitizeState((await api.putProgress(account.token, stateRef.current)).state);
        }
        pushedSeq.current = seqAtStart;
        // fold in anything another device had (the edits made meanwhile stay, being newer)
        const merged = mergeStates(stateRef.current, server);
        if (stateKey(merged) !== stateKey(stateRef.current)) setState(merged);
        setSync((s) => ({ ...s, status: 'synced', lastSyncAt: Date.now(), message: undefined }));
      })();
      busy.current = job;
      try {
        await job;
      } catch (e) {
        handleError(e);
      } finally {
        if (busy.current === job) busy.current = null;
      }
      // edits made during the request go out in the next push
      if (accountRef.current && editSeq.current !== pushedSeq.current) schedulePush();
    },
    [handleError],
  );

  const schedulePush = useCallback(() => {
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void runSync('push'), PUSH_DELAY);
  }, [runSync]);

  // pull on start, when the tab comes back, and when the network returns
  useEffect(() => {
    if (!sync.account) return;
    void runSync('pull');
    const onVisible = () => document.visibilityState === 'visible' && void runSync('pull');
    const onOnline = () => void runSync('pull');
    const onHide = () => {
      if (document.visibilityState === 'hidden' && editSeq.current !== pushedSeq.current) void runSync('push');
    };
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('online', onOnline);
    };
  }, [sync.account, runSync]);

  /** Every local change goes through here: it marks the state dirty (the effect below pushes it). */
  const mutate = useCallback((fn: (s: ProgressState) => ProgressState) => {
    setState((s) => {
      const next = fn(s);
      if (next !== s) editSeq.current++;
      return next;
    });
  }, []);

  useEffect(() => {
    if (accountRef.current && editSeq.current !== pushedSeq.current) schedulePush();
  }, [state, schedulePush]);

  const patchWord = useCallback(
    (id: string, fn: (p: WordProgress) => WordProgress) =>
      mutate((s) => {
        const next = fn({ ...(s.words[id] ?? {}) });
        // an emptied entry stays as { t } so the "un-mark" also reaches other devices
        return { ...s, words: { ...s.words, [id]: { ...next, t: Date.now() } } };
      }),
    [mutate],
  );

  const signIn = useCallback(async (mode: 'login' | 'register', username: string, password: string) => {
    const account = mode === 'login' ? await api.login(username, password) : await api.register(username, password);
    saveAccount(account);
    accountRef.current = account;
    setSync({ account, status: 'syncing' });
  }, []);

  const signOut = useCallback(async () => {
    window.clearTimeout(pushTimer.current);
    if (accountRef.current && editSeq.current !== pushedSeq.current) {
      try {
        await api.putProgress(accountRef.current.token, stateRef.current);
      } catch {
        /* keep going: the user asked to sign out */
      }
    }
    saveAccount(null);
    accountRef.current = null;
    setSync({ account: null, status: 'off' });
    // the progress lives on the server now; leave nothing behind on a shared computer
    setState((s) => ({ ...emptyState(), settings: s.settings, settingsAt: s.settingsAt }));
    editSeq.current = pushedSeq.current = 0;
  }, []);

  const api_ = useMemo<ProgressApi>(
    () => ({
      state,
      storageOk,
      sync,
      get: (id) => state.words[id],
      setStatus: (id, status) =>
        patchWord(id, (p) => {
          if (status === 'new') {
            delete p.status;
          } else {
            p.status = status;
            if (status === 'mastered') delete p.wrong;
          }
          return p;
        }),
      toggleStar: (id) =>
        patchWord(id, (p) => {
          if (p.starred) delete p.starred;
          else p.starred = true;
          return p;
        }),
      recordAnswer: (id, correct) =>
        patchWord(id, (p) => {
          if (correct) p.right = (p.right ?? 0) + 1;
          else {
            p.wrong = (p.wrong ?? 0) + 1;
            if (p.status === 'mastered') p.status = 'learning';
          }
          return p;
        }),
      updateScore: (scope, fn) =>
        mutate((s) => ({
          ...s,
          scores: { ...s.scores, [scope]: { ...fn(s.scores[scope] ?? {}), lastStudied: new Date().toISOString() } },
        })),
      touchUnit: (unitId) => mutate((s) => (s.lastUnitId === unitId ? s : { ...s, lastUnitId: unitId, lastUnitAt: Date.now() })),
      updateSettings: (patch) => mutate((s) => ({ ...s, settings: { ...s.settings, ...patch }, settingsAt: Date.now() })),
      replaceAll: (next) =>
        mutate(() => {
          // an imported file replaces everything, on every device
          const now = Date.now();
          const clean = sanitizeState(next);
          const words = Object.fromEntries(Object.entries(clean.words).map(([id, w]) => [id, { ...w, t: now }]));
          const scores = Object.fromEntries(Object.entries(clean.scores).map(([k, v]) => [k, { ...v, lastStudied: new Date(now).toISOString() }]));
          return { ...clean, words, scores, resetAt: now - 1, settingsAt: now, lastUnitAt: now };
        }),
      reset: () => mutate((s) => ({ ...emptyState(), settings: s.settings, settingsAt: s.settingsAt, resetAt: Date.now() })),
      masteredCount: (words) => words.reduce((n, w) => n + (state.words[w.id]?.status === 'mastered' ? 1 : 0), 0),
      signIn,
      signOut,
      syncNow: () => runSync('pull'),
    }),
    [state, storageOk, sync, patchWord, mutate, signIn, signOut, runSync],
  );

  return <Ctx.Provider value={api_}>{children}</Ctx.Provider>;
}

export function useProgress(): ProgressApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProgress must be used inside ProgressProvider');
  return v;
}

export const STORAGE_KEY = KEY;
