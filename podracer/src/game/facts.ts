import { MULTIPLIERS, ROUND_REPEATS } from './config';
import type { ChoiceStyle, Fact, Rng } from './types';

export function makeFact(family: number, multiplier: number): Fact {
  return { family, multiplier, answer: family * multiplier };
}

export function sameFact(a: Fact, b: Fact): boolean {
  return a.family === b.family && a.multiplier === b.multiplier;
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function hasAdjacentRepeat(facts: readonly Fact[]): boolean {
  for (let i = 1; i < facts.length; i++) {
    if (sameFact(facts[i - 1], facts[i])) return true;
  }
  return false;
}

/** Every fact ×1..×10 appears ROUND_REPEATS times, shuffled, avoiding back-to-back repeats. */
export function buildRoundQuestions(family: number, rng: Rng = Math.random): Fact[] {
  const facts: Fact[] = [];
  for (let r = 0; r < ROUND_REPEATS; r++) {
    for (const m of MULTIPLIERS) facts.push(makeFact(family, m));
  }
  let order = shuffle(facts, rng);
  for (let attempt = 0; attempt < 100 && hasAdjacentRepeat(order); attempt++) {
    order = shuffle(facts, rng);
  }
  return order;
}

export function randomFact(families: readonly number[], rng: Rng = Math.random, avoid?: Fact): Fact {
  let fact = makeFact(families[0], MULTIPLIERS[0]);
  for (let attempt = 0; attempt < 10; attempt++) {
    const family = families[Math.floor(rng() * families.length)];
    const multiplier = MULTIPLIERS[Math.floor(rng() * MULTIPLIERS.length)];
    fact = makeFact(family, multiplier);
    if (!avoid || !sameFact(fact, avoid)) break;
  }
  return fact;
}

function candidates(values: number[], answer: number, keep: (n: number) => boolean): number[] {
  return [...new Set(values)].filter((n) => n > 0 && n !== answer && keep(n));
}

/** Other multiples of the family, nearest multipliers first (each distance band shuffled). */
function nearbyMultiples(fact: Fact, rng: Rng): number[] {
  const { family, multiplier } = fact;
  const out: number[] = [];
  for (let d = 1; d <= MULTIPLIERS.length; d++) {
    const band = [multiplier - d, multiplier + d].filter((m) => m >= 1 && m <= MULTIPLIERS.length);
    out.push(...shuffle(band, rng).map((m) => family * m));
  }
  return out;
}

function reversedDigits(n: number): number {
  return Number(String(n).split('').reverse().join(''));
}

/**
 * Four options including the answer.
 * - 'multiples': every option is a multiple of the family (Rank B).
 * - 'mixed': at least one other multiple and at least one non-multiple distractor (Rank A).
 */
export function choicesFor(fact: Fact, style: ChoiceStyle, rng: Rng = Math.random, count = 4): number[] {
  const { family, multiplier, answer } = fact;
  const others = count - 1;

  if (style === 'multiples') {
    const near = nearbyMultiples(fact, rng);
    const pool = near.slice(0, Math.min(near.length, 6));
    const picked = shuffle(pool, rng).slice(0, others);
    for (const n of near) if (picked.length < others && !picked.includes(n)) picked.push(n);
    return shuffle([answer, ...picked], rng);
  }

  const isMultiple = (n: number) => n % family === 0;
  const multiples = shuffle(candidates([family * (multiplier + 1), family * (multiplier - 1)], answer, isMultiple), rng);
  const nonMultiples = shuffle(
    candidates(
      [
        (family + 1) * multiplier,
        (family - 1) * multiplier,
        answer + 1,
        answer - 1,
        answer + 2,
        answer - 2,
        answer + 10,
        answer - 10,
        family + multiplier,
        reversedDigits(answer),
      ],
      answer,
      (n) => !isMultiple(n),
    ),
    rng,
  );

  const wantNon = rng() < 0.5 ? 1 : 2;
  const picked = [...nonMultiples.slice(0, wantNon), ...multiples.slice(0, others - wantNon)];
  for (const n of [...multiples, ...nonMultiples, ...nearbyMultiples(fact, rng)]) {
    if (picked.length < others && !picked.includes(n)) picked.push(n);
  }
  return shuffle([answer, ...picked], rng);
}

export function skipCountRow(family: number): number[] {
  return MULTIPLIERS.map((m) => family * m);
}

export function formatFact(fact: Fact, swapped = false): string {
  return swapped ? `${fact.multiplier} × ${fact.family}` : `${fact.family} × ${fact.multiplier}`;
}
