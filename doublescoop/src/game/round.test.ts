import { describe, expect, it } from 'vitest';
import { CONE_BONUS, SCOOPS_PER_CONE } from './config';
import { answer, createRound, pointsForStreak, summarize, type RoundState } from './round';
import type { Problem } from './types';

const dbl = (n: number): Problem => ({ a: n, b: n, answer: n * 2, kind: 'double' });
const problems = (count: number) => Array.from({ length: count }, (_, i) => dbl((i % 10) + 1));

function answerRight(state: RoundState, ms = 1000): RoundState {
  return answer(state, state.problems[state.index].answer, ms);
}

function answerWrong(state: RoundState, ms = 1000): RoundState {
  return answer(state, state.problems[state.index].answer + 1, ms);
}

describe('scoring', () => {
  it('grows with the streak and caps', () => {
    expect(pointsForStreak(1)).toBe(10);
    expect(pointsForStreak(4)).toBe(40);
    expect(pointsForStreak(10)).toBe(100);
    expect(pointsForStreak(25)).toBe(100);
  });

  it('adds streak points plus the cone bonus on the fifth scoop', () => {
    let s = createRound('C', 'round', problems(20));
    for (let i = 0; i < SCOOPS_PER_CONE; i++) s = answerRight(s);
    expect(s.score).toBe(10 + 20 + 30 + 40 + 50 + CONE_BONUS);
    expect(s.lastEvent).toBe('cone');
    expect(s.lastPoints).toBe(50 + CONE_BONUS);
  });
});

describe('cones', () => {
  it('finishes a cone at five in a row and starts a fresh one', () => {
    let s = createRound('C', 'round', problems(20));
    for (let i = 0; i < 4; i++) {
      s = answerRight(s);
      expect(s.lastEvent).toBe('scoop');
    }
    expect(s.coneScoops).toBe(4);
    s = answerRight(s);
    expect(s.conesCompleted).toBe(1);
    expect(s.coneScoops).toBe(0);
    s = answerRight(s);
    expect(s.coneScoops).toBe(1);
  });

  it('topples the cone and resets the streak on a miss', () => {
    let s = createRound('B', 'round', problems(25));
    s = answerRight(answerRight(answerRight(s)));
    s = answerWrong(s);
    expect(s.lastEvent).toBe('topple');
    expect(s.coneScoops).toBe(0);
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(3);
    expect(s.status).toBe('playing');
    s = answerRight(s);
    expect(s.lastPoints).toBe(10);
  });

  it('treats a timeout as a miss', () => {
    let s = createRound('S', 'round', problems(35));
    s = answerRight(s);
    s = answer(s, null, 6000);
    expect(s.lastEvent).toBe('topple');
    expect(s.wrong).toBe(1);
    expect(s.misses[0].given).toBeNull();
  });
});

describe('round end', () => {
  it('finishes a normal round after the last question, even with misses', () => {
    let s = createRound('C', 'round', problems(3));
    s = answerWrong(answerRight(s));
    expect(s.status).toBe('playing');
    s = answerRight(s);
    expect(s.status).toBe('finished');
    const r = summarize(s);
    expect(r.passed).toBe(true);
    expect(r.accuracy).toBeCloseTo(2 / 3);
  });

  it('ends a test on the first miss', () => {
    let s = createRound('A', 'test', problems(30));
    s = answerRight(answerRight(s));
    s = answerWrong(s);
    expect(s.status).toBe('failed');
    expect(answerRight(s)).toBe(s);
    const r = summarize(s);
    expect(r.passed).toBe(false);
    expect(r.answered).toBe(3);
  });

  it('passes a perfect test', () => {
    let s = createRound('C', 'test', problems(20));
    while (s.status === 'playing') s = answerRight(s);
    expect(summarize(s).passed).toBe(true);
  });

  it('averages answer times', () => {
    let s = createRound('C', 'round', problems(2));
    s = answerRight(s, 1000);
    s = answerRight(s, 3000);
    expect(summarize(s).avgMs).toBe(2000);
  });
});
