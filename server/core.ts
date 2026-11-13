// Backend logic for progress sync, independent of Netlify so it can be tested and run locally.
// Storage is any key-value store with conditional writes (Netlify Blobs in production).
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { emptyState, mergeStates, sanitizeState } from '../src/lib/state.ts';
import type { ProgressState } from '../src/types/vocab.ts';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export interface KV {
  get(key: string): Promise<{ data: unknown; etag?: string } | null>;
  /** returns false when the condition failed (key exists for onlyIfNew, etag changed for onlyIfMatch) */
  set(key: string, value: unknown, cond?: { onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<boolean>;
}

export interface Env {
  secret: string | undefined;
  users: KV;
  progress: KV;
  now?: () => number;
}

interface UserRecord {
  username: string;
  salt: string;
  hash: string;
  createdAt: string;
  fails?: number;
  lockedUntil?: number;
}

const TOKEN_DAYS = 180;
const MAX_FAILS = 8;
const LOCK_MS = 10 * 60 * 1000;
const MAX_BODY = 512 * 1024;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const fail = (status: number, error: string, code?: string) => json(status, { error, code });

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function signToken(username: string, secret: string, now: number): string {
  const payload = b64url(JSON.stringify({ u: username, exp: now + TOKEN_DAYS * 864e5 }));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string, secret: string, now: number): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expect = createHmac('sha256', secret).update(payload).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof u === 'string' && typeof exp === 'number' && exp > now ? u : null;
  } catch {
    return null;
  }
}

async function hashPassword(password: string, salt: Buffer) {
  return (await scrypt(password.normalize('NFC'), salt, 32, SCRYPT)).toString('base64');
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

function credentials(body: Record<string, unknown> | null) {
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  return { username, password };
}

const userKey = (u: string) => `user/${u}`;
const progressKey = (u: string) => `progress/${u}`;

async function register(req: Request, env: Env, secret: string, now: number) {
  const { username, password } = credentials(await readBody(req));
  if (!USERNAME_RE.test(username)) {
    return fail(400, 'Tên đăng nhập dài 3–24 ký tự, chỉ gồm chữ không dấu, số và . _ -', 'bad_username');
  }
  if (password.length < 6 || password.length > 72) return fail(400, 'Mật khẩu cần từ 6 đến 72 ký tự.', 'bad_password');
  const salt = randomBytes(16);
  const rec: UserRecord = { username, salt: salt.toString('base64'), hash: await hashPassword(password, salt), createdAt: new Date(now).toISOString() };
  const created = await env.users.set(userKey(username), rec, { onlyIfNew: true });
  if (!created) return fail(409, 'Tên đăng nhập này đã có người dùng.', 'taken');
  return json(201, { username, token: signToken(username, secret, now) });
}

async function login(req: Request, env: Env, secret: string, now: number) {
  const { username, password } = credentials(await readBody(req));
  const wrong = () => fail(401, 'Sai tên đăng nhập hoặc mật khẩu.', 'bad_login');
  if (!USERNAME_RE.test(username) || !password) return wrong();
  const found = await env.users.get(userKey(username));
  if (!found) return wrong();
  const rec = found.data as UserRecord;
  if (rec.lockedUntil && rec.lockedUntil > now) {
    const min = Math.ceil((rec.lockedUntil - now) / 60000);
    return fail(429, `Nhập sai quá nhiều lần. Thử lại sau ${min} phút.`, 'locked');
  }
  const hash = await hashPassword(password, Buffer.from(rec.salt, 'base64'));
  const ok = timingSafeEqual(Buffer.from(hash, 'base64'), Buffer.from(rec.hash, 'base64'));
  if (!ok) {
    const fails = (rec.fails ?? 0) + 1;
    const next: UserRecord = { ...rec, fails: fails >= MAX_FAILS ? 0 : fails, lockedUntil: fails >= MAX_FAILS ? now + LOCK_MS : rec.lockedUntil };
    await env.users.set(userKey(username), next, found.etag ? { onlyIfMatch: found.etag } : undefined);
    return wrong();
  }
  if (rec.fails || rec.lockedUntil) {
    const { fails: _f, lockedUntil: _l, ...clean } = rec;
    await env.users.set(userKey(username), clean, found.etag ? { onlyIfMatch: found.etag } : undefined);
  }
  return json(200, { username, token: signToken(username, secret, now) });
}

async function getProgress(env: Env, username: string) {
  const found = await env.progress.get(progressKey(username));
  return json(200, { state: found ? sanitizeState(found.data) : emptyState() });
}

async function putProgress(req: Request, env: Env, username: string) {
  const body = await readBody(req);
  if (!body || !body.state) return fail(400, 'Dữ liệu không hợp lệ.', 'bad_body');
  const incoming = sanitizeState(body.state);
  // read-merge-write with an etag check, retried if another device wrote in between
  for (let attempt = 0; attempt < 5; attempt++) {
    const found = await env.progress.get(progressKey(username));
    const merged: ProgressState = found ? mergeStates(sanitizeState(found.data), incoming) : incoming;
    const ok = await env.progress.set(progressKey(username), merged, found?.etag ? { onlyIfMatch: found.etag } : { onlyIfNew: true });
    if (ok) return json(200, { state: merged });
  }
  return fail(409, 'Đang có máy khác đồng bộ, thử lại sau.', 'busy');
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const now = (env.now ?? Date.now)();
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const route = `${req.method} ${path.slice(path.indexOf('/api') + 4) || '/'}`;
  if (!env.secret || env.secret.length < 32) {
    return fail(500, 'Máy chủ chưa cấu hình SESSION_SECRET (ít nhất 32 ký tự).', 'no_secret');
  }
  try {
    switch (route) {
      case 'GET /health':
        return json(200, { ok: true });
      case 'POST /auth/register':
        return await register(req, env, env.secret, now);
      case 'POST /auth/login':
        return await login(req, env, env.secret, now);
      case 'GET /progress':
      case 'PUT /progress': {
        const auth = req.headers.get('authorization') ?? '';
        const username = auth.startsWith('Bearer ') ? verifyToken(auth.slice(7), env.secret, now) : null;
        if (!username) return fail(401, 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.', 'unauthorized');
        return route.startsWith('GET') ? await getProgress(env, username) : await putProgress(req, env, username);
      }
      default:
        return fail(404, 'Không tìm thấy.', 'not_found');
    }
  } catch (e) {
    console.error(e);
    return fail(500, 'Lỗi máy chủ, thử lại sau.', 'server_error');
  }
}

/** In-memory KV with the same conditional-write rules, for tests and local dev. */
export function memoryKV(seed?: Map<string, { data: unknown; etag: string }>, onChange?: () => void): KV & { dump(): Map<string, { data: unknown; etag: string }> } {
  const m = seed ?? new Map<string, { data: unknown; etag: string }>();
  let n = 0;
  return {
    async get(key) {
      const v = m.get(key);
      return v ? { data: structuredClone(v.data), etag: v.etag } : null;
    },
    async set(key, value, cond) {
      const cur = m.get(key);
      if (cond?.onlyIfNew && cur) return false;
      if (cond?.onlyIfMatch && cur?.etag !== cond.onlyIfMatch) return false;
      m.set(key, { data: structuredClone(value), etag: `"${Date.now()}-${++n}"` });
      onChange?.();
      return true;
    },
    dump: () => m,
  };
}
