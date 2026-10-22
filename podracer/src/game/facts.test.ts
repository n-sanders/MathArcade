import { describe, expect, it } from 'vitest';
import { buildRoundQuestions, choicesFor, makeFact, randomFact, sameFact, skipCountRow } from './facts';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('buildRoundQuestions', () => {
  it('includes every fact ×1..×10 exactly twice', () => {
    const qs = buildRoundQuestions(4, seeded(1));
    expect(qs).toHaveLength(20);
    for (let m = 1; m <= 10; m++) {
      expect(qs.filter((q) => q.multiplier === m)).toHaveLength(2);
    }
    expect(qs.every((q) => q.family === 4 && q.answer === 4 * q.multiplier)).toBe(true);
  });

  it('avoids asking the same fact twice in a row', () => {
    for (let seed = 0; seed < 50; seed++) {
      const qs = buildRoundQuestions(7, seeded(seed));
      for (let i = 1; i < qs.length; i++) expect(sameFact(qs[i - 1], qs[i])).toBe(false);
    }
  });
});

function everyFact(each: (fact: ReturnType<typeof makeFact>, seed: number) => void) {
  let seed = 0;
  for (let family = 2; family <= 12; family++) {
    for (let m = 1; m <= 10; m++) {
      for (let r = 0; r < 5; r++) each(makeFact(family, m), seed++);
    }
  }
}

function expectValidChoices(choices: number[], answer: number) {
  expect(choices).toHaveLength(4);
  expect(new Set(choices).size).toBe(4);
  expect(choices).toContain(answer);
  expect(choices.every((c) => c > 0)).toBe(true);
}

describe('choicesFor', () => {
  it('multiples style: 4 unique options, all multiples of the family', () => {
    everyFact((fact, seed) => {
      const choices = choicesFor(fact, 'multiples', seeded(seed));
      expectValidChoices(choices, fact.answer);
      expect(choices.every((c) => c % fact.family === 0)).toBe(true);
    });
  });

  it('mixed style: includes at least one other multiple and at least one non-multiple', () => {
    everyFact((fact, seed) => {
      const choices = choicesFor(fact, 'mixed', seeded(seed));
      expectValidChoices(choices, fact.answer);
      const others = choices.filter((c) => c !== fact.answer);
      expect(others.some((c) => c % fact.family === 0)).toBe(true);
      expect(others.some((c) => c % fact.family !== 0)).toBe(true);
    });
  });
});

describe('randomFact', () => {
  it('stays within the given families and avoids the previous fact', () => {
    const rng = seeded(3);
    let prev = randomFact([3, 5], rng);
    for (let i = 0; i < 100; i++) {
      const f = randomFact([3, 5], rng, prev);
      expect([3, 5]).toContain(f.family);
      expect(sameFact(f, prev)).toBe(false);
      prev = f;
    }
  });
});

it('skipCountRow lists the family skip-count', () => {
  expect(skipCountRow(4)).toEqual([4, 8, 12, 16, 20, 24, 28, 32, 36, 40]);
});
