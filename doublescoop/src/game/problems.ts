import { MAX_ADDEND, MIN_ADDEND, RANK_RULES } from './config';
import type { Problem, ProblemKind, Rank } from './types';

export type Rng = () => number;

function randInt(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const KIND_GAP: Record<ProblemKind, number> = { double: 0, near1: 1, near2: 2 };

/** Order-insensitive identity: 6 + 7 and 7 + 6 are the same fact. */
export function problemKey(p: Pick<Problem, 'a' | 'b'>): string {
  return `${Math.min(p.a, p.b)}+${Math.max(p.a, p.b)}`;
}

export function makeProblem(kind: ProblemKind, rng: Rng = Math.random): Problem {
  const gap = KIND_GAP[kind];
  const low = randInt(MIN_ADDEND, MAX_ADDEND - gap, rng);
  const high = low + gap;
  const [a, b] = rng() < 0.5 ? [low, high] : [high, low];
  return { a, b, answer: a + b, kind };
}

/** Splits `total` across kinds by share, giving leftovers to the largest remainders. */
export function kindCounts(total: number, mix: Record<ProblemKind, number>): Record<ProblemKind, number> {
  const kinds = Object.keys(mix) as ProblemKind[];
  const exact = kinds.map((k) => ({ k, value: total * mix[k] }));
  const counts = Object.fromEntries(exact.map(({ k, value }) => [k, Math.floor(value)])) as Record<ProblemKind, number>;
  let left = total - kinds.reduce((sum, k) => sum + counts[k], 0);
  const byRemainder = [...exact].sort((x, y) => (y.value % 1) - (x.value % 1));
  for (const { k } of byRemainder) {
    if (left <= 0) break;
    if (mix[k] > 0) {
      counts[k]++;
      left--;
    }
  }
  return counts;
}

/** Swaps later items forward so no fact appears twice in a row (when the list allows it). */
export function avoidRepeats(problems: Problem[]): Problem[] {
  const out = [...problems];
  const clashAt = (idx: number) =>
    (idx > 0 && problemKey(out[idx]) === problemKey(out[idx - 1])) ||
    (idx < out.length - 1 && problemKey(out[idx]) === problemKey(out[idx + 1]));
  for (let i = 1; i < out.length; i++) {
    if (problemKey(out[i]) !== problemKey(out[i - 1])) continue;
    for (let j = 0; j < out.length; j++) {
      if (problemKey(out[j]) === problemKey(out[i])) continue;
      [out[i], out[j]] = [out[j], out[i]];
      if (!clashAt(i) && !clashAt(j)) break;
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

function doublesDeck(count: number, rng: Rng): Problem[] {
  const deck: Problem[] = [];
  while (deck.length < count) {
    const pass = shuffle(
      Array.from({ length: MAX_ADDEND - MIN_ADDEND + 1 }, (_, i) => {
        const n = MIN_ADDEND + i;
        return { a: n, b: n, answer: n * 2, kind: 'double' as const };
      }),
      rng,
    );
    deck.push(...pass);
  }
  return deck.slice(0, count);
}

export function buildRound(rank: Rank, rng: Rng = Math.random): Problem[] {
  const rules = RANK_RULES[rank];
  const counts = kindCounts(rules.questions, rules.mix);
  const doubles = doublesDeck(counts.double, rng);
  const near: Problem[] = [];
  for (const kind of ['near1', 'near2'] as const) {
    for (let i = 0; i < counts[kind]; i++) near.push(makeProblem(kind, rng));
  }
  return avoidRepeats(shuffle([...doubles, ...near], rng));
}

export function formatProblem(p: Problem): string {
  return `${p.a} + ${p.b}`;
}
