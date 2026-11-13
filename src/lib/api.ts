import type { ProgressState } from '../types/vocab';

export interface Account {
  username: string;
  token: string;
}

const ACCOUNT_KEY = 'b1vocab:account';

export function loadAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    const a = raw ? JSON.parse(raw) : null;
    return a && typeof a.username === 'string' && typeof a.token === 'string' ? a : null;
  } catch {
    return null;
  }
}

export function saveAccount(a: Account | null) {
  try {
    if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* storage blocked: the session lasts until the tab closes */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

/** Network failure (offline, server unreachable) rather than an answer from the server. */
export class OfflineError extends Error {}

async function request<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new OfflineError('Không kết nối được máy chủ.');
  }
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON (e.g. 404 page when the API is not deployed) */
  }
  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : res.status === 404 ? 'Máy chủ đồng bộ chưa được bật.' : 'Máy chủ đang lỗi, thử lại sau.';
    throw new ApiError(msg, res.status, typeof data.code === 'string' ? data.code : undefined);
  }
  return data as T;
}

export const api = {
  register: (username: string, password: string) => request<Account>('POST', '/auth/register', { username, password }),
  login: (username: string, password: string) => request<Account>('POST', '/auth/login', { username, password }),
  getProgress: (token: string) => request<{ state: ProgressState }>('GET', '/progress', undefined, token),
  putProgress: (token: string, state: ProgressState) => request<{ state: ProgressState }>('PUT', '/progress', { state }, token),
};
