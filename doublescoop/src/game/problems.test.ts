import { describe, expect, it } from 'vitest';
import { MAX_ADDEND, MIN_ADDEND, RANK_RULES } from './config';
import { avoidRepeats, buildRound, kindCounts, makeProblem, problemKey } from './problems';
import { RANK_ORDER, type Problem } from './types';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function hasBackToBack(problems: Problem[]): boolean {
  return problems.some((p, i) => i > 0 && problemKey(p) === problemKey(problems[i - 1]));
}

describe('makeProblem', () => {
  it('keeps addends in range with the right gap', () => {
    const rng = seeded(1);
    for (let i = 0; i < 500; i++) {
      for (const [kind, gap] of [['double', 0], ['near1', 1], ['near2', 2]] as const) {
        const p = makeProblem(kind, rng);
        expect(Math.abs(p.a - p.b)).toBe(gap);
        expect(Math.min(p.a, p.b)).toBeGreaterThanOrEqual(MIN_ADDEND);
        expect(Math.max(p.a, p.b)).toBeLessThanOrEqual(MAX_ADDEND);
        expect(p.answer).toBe(p.a + p.b);
      }
    }
  });

  it('randomizes addend order', () => {
    const rng = seeded(2);
    const firstBigger = Array.from({ length: 200 }, () => makeProblem('near1', rng)).filter((p) => p.a > p.b).length;
    expect(firstBigger).toBeGreaterThan(50);
    expect(firstBigger).toBeLessThan(150);
  });
});

describe('kindCounts', () => {
  it('sums to the total and skips kinds with no share', () => {
    expect(kindCounts(25, RANK_RULES.B.mix)).toEqual({ double: 10, near1: 15, near2: 0 });
    const a = kindCounts(30, RANK_RULES.A.mix);
    expect(a.double + a.near1 + a.near2).toBe(30);
    expect(a.double).toBe(9);
  });
});

describe('buildRound', () => {
  it('matches each rank length and mix', () => {
    for (const rank of RANK_ORDER) {
      const rules = RANK_RULES[rank];
      const round = buildRound(rank, seeded(rank.charCodeAt(0)));
      expect(round).toHaveLength(rules.questions);
      const counts = kindCounts(rules.questions, rules.mix);
      for (const kind of ['double', 'near1', 'near2'] as const) {
        expect(round.filter((p) => p.kind === kind)).toHaveLength(counts[kind]);
      }
    }
  });

  it('deals every double twice at rank C', () => {
    const round = buildRound('C', seeded(7));
    for (let n = MIN_ADDEND; n <= MAX_ADDEND; n++) {
      expect(round.filter((p) => p.a === n && p.b === n)).toHaveLength(2);
    }
  });

  it('never repeats a fact back to back', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const rank of RANK_ORDER) expect(hasBackToBack(buildRound(rank, seeded(seed)))).toBe(false);
    }
  });
});

describe('avoidRepeats', () => {
  it('splits up adjacent duplicates, including swapped addends', () => {
    const p = (a: number, b: number): Problem => ({ a, b, answer: a + b, kind: a === b ? 'double' : 'near1' });
    const fixed = avoidRepeats([p(3, 3), p(3, 3), p(6, 7), p(7, 6), p(1, 1), p(2, 2)]);
    expect(hasBackToBack(fixed)).toBe(false);
    expect(fixed).toHaveLength(6);
  });
});
