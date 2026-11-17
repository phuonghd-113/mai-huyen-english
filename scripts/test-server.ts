// Run: npm run test:server — exercises server/core.ts and the merge rules without Netlify.
import assert from 'node:assert/strict';
import { handle, memoryKV, signToken, verifyToken, type Env } from '../server/core.ts';
import { emptyState, MAX_ATTEMPTS, mergeStates, sanitizeState } from '../src/lib/state.ts';
import { applyAnswer, isDue, SRS_DAYS } from '../src/lib/srs.ts';
import { dueQuestions, pickPractice, queuedQuestions, typeStats } from '../src/lib/practice.ts';
import type { BankQuestion } from '../src/types/exam.ts';

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

// ---- state v2: exam questions and attempts
const attempt = (id: string, t: number, extra: Record<string, unknown> = {}) => ({ id, examId: 'mau-01', startedAt: t, answers: { 'mau-01-s3-1': 'C' }, t, ...extra });

await test('dữ liệu v1 (chỉ có từ vựng) được nâng lên v2, không mất gì', () => {
  const v1 = { version: 1, words: { 'u03-beat': { status: 'mastered', t: 5 } }, scores: { u03: { bestQuiz: 80 } }, settings: { accent: 'en-US', rate: 1, autoSpeak: false } };
  const s = sanitizeState(v1);
  assert.equal(s.version, 2);
  assert.equal(s.words['u03-beat'].status, 'mastered');
  assert.equal(s.scores.u03.bestQuiz, 80);
  assert.equal(s.settings.accent, 'en-US');
  assert.deepEqual(s.questions, {});
  assert.deepEqual(s.attempts, {});
});

await test('câu hỏi và lần làm đề: bản sửa sau cùng thắng khi gộp hai máy', () => {
  const a = { ...emptyState(), questions: { 'mau-01-s3-1': { wrong: 1, missed: true, t: 100 } }, attempts: { a1: attempt('a1', 100) } };
  const b = { ...emptyState(), questions: { 'mau-01-s3-1': { right: 1, t: 200 }, 'mau-01-s5-1': { wrong: 2, t: 50 } }, attempts: { a1: attempt('a1', 300, { submittedAt: 300, score: 15 }), a2: attempt('a2', 90) } };
  const m = mergeStates(sanitizeState(a), sanitizeState(b));
  assert.deepEqual(m.questions['mau-01-s3-1'], { right: 1, t: 200 });
  assert.equal(m.questions['mau-01-s5-1'].wrong, 2);
  assert.equal(m.attempts.a1.score, 15);
  assert.ok(m.attempts.a2);
});

await test('lần làm đề được đồng bộ qua server', async () => {
  await call('PUT', '/progress', { state: { ...emptyState(), attempts: { 'try-1': attempt('try-1', clock, { remainingMs: 600000 }) } } }, token);
  const got = (await call('GET', '/progress', undefined, token)).body.state;
  assert.equal(got.attempts['try-1'].remainingMs, 600000);
  assert.equal(got.attempts['try-1'].answers['mau-01-s3-1'], 'C');
  assert.ok(got.words['u03-beat'], 'tiến độ từ vựng vẫn còn');
});

await test('"Xóa tiến độ" xóa cả câu hỏi và lần làm đề cũ', () => {
  const old = { ...emptyState(), questions: { 'mau-01-s3-1': { wrong: 1, t: 100 } }, attempts: { a1: attempt('a1', 100) } };
  const m = mergeStates(sanitizeState(old), { ...emptyState(), resetAt: 200 });
  assert.deepEqual(m.questions, {});
  assert.deepEqual(m.attempts, {});
});

await test(`chỉ giữ ${MAX_ATTEMPTS} lần làm đề mới nhất, máy nào cũng giữ đúng các lần đó`, () => {
  const many = Object.fromEntries(Array.from({ length: MAX_ATTEMPTS + 5 }, (_, i) => [`a${i}`, attempt(`a${i}`, 1000 + i)]));
  const s = sanitizeState({ attempts: many });
  assert.equal(Object.keys(s.attempts).length, MAX_ATTEMPTS);
  assert.ok(!s.attempts.a0 && s.attempts[`a${MAX_ATTEMPTS + 4}`]);
  assert.equal(Object.keys(mergeStates(s, sanitizeState({ attempts: { a0: attempt('a0', 1000) } })).attempts).length, MAX_ATTEMPTS);
});

await test('bỏ dữ liệu rác trong câu hỏi và lần làm đề', () => {
  const s = sanitizeState({
    questions: { 'mau-01-s3-1': { wrong: -1, missed: 'yes', srs: { due: 'x', step: 1 } }, 'BAD ID': { wrong: 1 } },
    attempts: {
      ok: { examId: 'mau-01', startedAt: 1, t: 1, answers: { 'mau-01-s3-1': 'C', 'mau-01-s3-2': 42, '../x': 'A', 'mau-01-s11-1': 'x'.repeat(7000) }, flagged: ['mau-01-s3-1', 'mau-01-s3-1', 7], selfScores: { s11: 2, s12: -1 } },
      noExam: { startedAt: 1, t: 1, answers: {} },
    },
  });
  assert.deepEqual(s.questions, { 'mau-01-s3-1': {} });
  assert.deepEqual(Object.keys(s.attempts), ['ok']);
  assert.deepEqual(s.attempts.ok.answers, { 'mau-01-s3-1': 'C' });
  assert.deepEqual(s.attempts.ok.flagged, ['mau-01-s3-1']);
  assert.deepEqual(s.attempts.ok.selfScores, { s11: 2 });
});

await test('lặp lại ngắt quãng: sai → ôn sau 1 ngày, đúng liên tiếp → giãn dần rồi ra khỏi sổ lỗi', () => {
  const day = 86_400_000;
  let p = applyAnswer({}, true, 0);
  assert.equal(p.srs, undefined, 'đúng ngay từ đầu thì không vào sổ lỗi');
  p = applyAnswer(p, false, 0);
  assert.deepEqual([p.missed, p.srs], [true, { step: 0, due: day }]);
  assert.ok(!isDue(p, day - 1) && isDue(p, day));
  for (let i = 1; i < SRS_DAYS.length; i++) {
    p = applyAnswer(p, true, 0);
    assert.equal(p.srs?.due, SRS_DAYS[i] * day);
    assert.equal(p.missed, undefined);
  }
  p = applyAnswer(p, true, 0);
  assert.equal(p.srs, undefined, 'đúng đủ các mốc thì ra khỏi hàng ôn');
  assert.deepEqual([p.right, p.wrong], [SRS_DAYS.length + 1, 1]);
});

// ---- practice by type and the mistakes notebook
const bq = (id: string, type: BankQuestion['type'], answers = ['x']): BankQuestion => ({ id, type, prompt: id, answers, examId: 'e', sectionId: 's1', instruction: '' });
const bank: BankQuestion[] = [
  bq('wf-1', 'word-form'),
  bq('wf-2', 'word-form'),
  bq('wf-3', 'word-form'),
  bq('wf-4', 'word-form', []), // no key
  bq('wr-1', 'writing', []),
  bq('vf-1', 'verb-form'),
];

await test('luyện theo dạng: đúng dạng, bỏ câu không có đáp án, ưu tiên câu chưa làm rồi câu hay sai', () => {
  const progress = { 'wf-1': { right: 5, t: 1 }, 'wf-2': { wrong: 3, right: 1, missed: true, t: 1 } };
  for (let i = 0; i < 200; i++) {
    const got = pickPractice(bank, progress, 'word-form', 3).map((q) => q.id);
    assert.deepEqual(got, ['wf-3', 'wf-2', 'wf-1']);
  }
  assert.deepEqual(pickPractice(bank, {}, 'writing', 5), []);
  assert.equal(pickPractice(bank, {}, 'word-form', 10).length, 3);
});

await test('sổ lỗi sai: câu sai vào sổ, đến hạn sau 1 ngày, sắp theo hạn ôn', () => {
  const day = 86_400_000;
  const progress = { 'wf-1': applyAnswer({}, false, 2 * day), 'vf-1': applyAnswer({}, false, 0), 'wf-3': applyAnswer({}, true, 0) };
  assert.deepEqual(queuedQuestions(bank, progress).map((q) => q.id), ['vf-1', 'wf-1']);
  assert.deepEqual(dueQuestions(bank, progress, day).map((q) => q.id), ['vf-1']);
  const st = typeStats(bank, progress).find((x) => x.type === 'word-form')!;
  assert.deepEqual([st.total, st.seen, st.right, st.wrong], [3, 2, 1, 1]);
});

console.log(`\n${passed} test đều qua`);
