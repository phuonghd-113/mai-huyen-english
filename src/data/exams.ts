// Exam papers live in src/data/exams/<id>.json. Each file becomes its own chunk, loaded only when needed.
import type { BankQuestion, Exam } from '../types/exam';
import { toBank } from '../lib/grade';

const files = import.meta.glob<Exam>('./exams/*.json', { import: 'default' });
const pathOf = (id: string) => `./exams/${id}.json`;

export const EXAM_IDS: string[] = Object.keys(files)
  .map((p) => p.slice('./exams/'.length, -'.json'.length))
  .sort();

const cache = new Map<string, Promise<Exam | undefined>>();

export function loadExam(id: string): Promise<Exam | undefined> {
  const load = files[pathOf(id)];
  if (!load) return Promise.resolve(undefined);
  let p = cache.get(id);
  if (!p) {
    p = load().catch((e) => {
      cache.delete(id); // let a later visit retry (offline, new deploy…)
      throw e;
    });
    cache.set(id, p);
  }
  return p;
}

/** Every paper, newest first. The hand-made sample is left out once real papers exist. */
export async function loadAllExams(): Promise<Exam[]> {
  const all = (await Promise.all(EXAM_IDS.map(loadExam))).filter((e): e is Exam => !!e);
  const real = all.filter((e) => !e.sample);
  return (real.length ? real : all).sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title, 'vi'));
}

export async function loadBank(): Promise<BankQuestion[]> {
  return toBank(await loadAllExams());
}
