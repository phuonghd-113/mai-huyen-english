// Run: npm run test:server — exercises server/core.ts and the merge rules without Netlify.
import assert from 'node:assert/strict';
import { handle, memoryKV, signToken, verifyToken, type Env } from '../server/core.ts';
import { emptyState, mergeStates, sanitizeState } from '../src/lib/state.ts';

const SECRET = 'x'.repeat(40);
let clock = Date.UTC(2026, 10, 12);
const env: Env = { secret: SECRET, users: memoryKV(), progress: memoryKV(), now: () => clock };

const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const res = await handle(
    new Request(`http://local/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
};

await test('từ chối khi thiếu SESSION_SECRET', async () => {
  const r = await handle(new Request('http://local/api/health'), { ...env, secret: undefined });
  assert.equal(r.status, 500);
});

await test('đăng ký: kiểm tra tên và mật khẩu', async () => {
  assert.equal((await call('POST', '/auth/register', { username: 'ab', password: '123456' })).status, 400);
  assert.equal((await call('POST', '/auth/register', { username: 'Nguyễn', password: '123456' })).status, 400);
  assert.equal((await call('POST', '/auth/register', { username: 'mai.huyen', password: '123' })).status, 400);
});

let token = '';
await test('đăng ký thành công, tên trùng bị từ chối, không phân biệt hoa thường', async () => {
  const r = await call('POST', '/auth/register', { username: ' Mai.Huyen ', password: 'bi-mat-123' });
  assert.equal(r.status, 201);
  assert.equal(r.body.username, 'mai.huyen');
  token = r.body.token;
  assert.equal((await call('POST', '/auth/register', { username: 'mai.huyen', password: 'khac-123' })).status, 409);
});

await test('mật khẩu được băm, không lưu dạng thô', async () => {
  const rec = (await env.users.get('user/mai.huyen'))!.data as Record<string, string>;
  assert.ok(rec.hash && rec.salt);
  assert.ok(!JSON.stringify(rec).includes('bi-mat-123'));
});

await test('đăng nhập đúng/sai', async () => {
  assert.equal((await call('POST', '/auth/login', { username: 'mai.huyen', password: 'sai-roi' })).status, 401);
  assert.equal((await call('POST', '/auth/login', { username: 'khong-co', password: 'bi-mat-123' })).status, 401);
  const ok = await call('POST', '/auth/login', { username: 'MAI.HUYEN', password: 'bi-mat-123' });
  assert.equal(ok.status, 200);
});

await test('khóa 10 phút sau 8 lần sai, mở lại sau đó', async () => {
  await call('POST', '/auth/register', { username: 'test.lock', password: 'dung-123' });
  for (let i = 0; i < 8; i++) await call('POST', '/auth/login', { username: 'test.lock', password: 'sai' });
  assert.equal((await call('POST', '/auth/login', { username: 'test.lock', password: 'dung-123' })).status, 429);
  clock += 11 * 60 * 1000;
  assert.equal((await call('POST', '/auth/login', { username: 'test.lock', password: 'dung-123' })).status, 200);
});

await test('token: giả mạo hoặc hết hạn đều bị từ chối', async () => {
  assert.equal(verifyToken(token, SECRET, clock), 'mai.huyen');
  assert.equal(verifyToken(token, 'y'.repeat(40), clock), null);
  const forged = signToken('nguoi-khac', 'y'.repeat(40), clock);
  assert.equal((await call('GET', '/progress', undefined, forged)).status, 401);
  assert.equal(verifyToken(token, SECRET, clock + 181 * 864e5), null);
  assert.equal((await call('GET', '/progress')).status, 401);
});

await test('tiến độ: máy A và máy B gộp lại, không mất từ nào', async () => {
  const empty = await call('GET', '/progress', undefined, token);
  assert.deepEqual(empty.body.state.words, {});
  const a = { ...emptyState(), words: { 'u03-beat': { status: 'mastered', t: 100 }, 'u03-club': { starred: true, t: 100 } } };
  const b = { ...emptyState(), words: { 'u03-beat': { status: 'learning', t: 50 }, 'u09-ferry': { status: 'learning', wrong: 2, t: 120 } } };
  await call('PUT', '/progress', { state: a }, token);
  const r = await call('PUT', '/progress', { state: b }, token);
  assert.equal(r.status, 200);
  const w = r.body.state.words;
  assert.equal(w['u03-beat'].status, 'mastered', 'bản mới hơn (t=100) thắng');
  assert.equal(w['u03-club'].starred, true);
  assert.equal(w['u09-ferry'].wrong, 2);
  const again = await call('GET', '/progress', undefined, token);
  assert.deepEqual(again.body.state.words, w);
});

await test('điểm cao: lấy giá trị tốt nhất của các máy', () => {
  const a = { ...emptyState(), scores: { u03: { bestQuiz: 80, bestMatchMs: 9000, lastStudied: '2026-11-01T00:00:00.000Z' } } };
  const b = { ...emptyState(), scores: { u03: { bestQuiz: 60, bestMatchMs: 7000, bestSpell: 90, lastStudied: '2026-11-02T00:00:00.000Z' } } };
  const m = mergeStates(a, b);
  assert.deepEqual(m.scores.u03, { bestQuiz: 80, bestSpell: 90, bestMatchMs: 7000, lastStudied: '2026-11-02T00:00:00.000Z' });
});

await test('"Xóa tiến độ" trên một máy không bị máy kia ghi ngược lại', () => {
  const old = { ...emptyState(), words: { 'u03-beat': { status: 'mastered' as const, t: 100 } }, scores: { u03: { bestQuiz: 90, lastStudied: new Date(100).toISOString() } } };
  const wiped = { ...emptyState(), resetAt: 200, words: { 'u06-brain': { starred: true, t: 300 } } };
  const m = mergeStates(old, wiped);
  assert.equal(m.words['u03-beat'], undefined);
  assert.equal(m.words['u06-brain'].starred, true);
  assert.deepEqual(m.scores, {});
});

await test('tiến độ cũ (chưa có dấu thời gian) vẫn được giữ khi đồng bộ lần đầu', () => {
  const legacy = sanitizeState({ words: { 'u03-beat': { status: 'mastered' } } });
  assert.equal(mergeStates(legacy, emptyState()).words['u03-beat'].status, 'mastered');
});

await test('bỏ dữ liệu rác từ client', () => {
  const s = sanitizeState({ words: { 'u03-beat': { status: 'hacked', wrong: -5, t: 'x' }, '../evil': { starred: true } }, settings: { rate: 99 } });
  assert.deepEqual(s.words, { 'u03-beat': {} });
  assert.equal(s.settings.rate, 0.9);
});

await test('hai máy ghi cùng lúc: cả hai thay đổi đều còn', async () => {
  const p1 = call('PUT', '/progress', { state: { ...emptyState(), words: { 'u12-loyal': { starred: true, t: 500 } } } }, token);
  const p2 = call('PUT', '/progress', { state: { ...emptyState(), words: { 'u15-coin': { status: 'mastered', t: 500 } } } }, token);
  await Promise.all([p1, p2]);
  const w = (await call('GET', '/progress', undefined, token)).body.state.words;
  assert.ok(w['u12-loyal'] && w['u15-coin'] && w['u03-beat']);
});

console.log(`\n${passed} test đều qua`);
