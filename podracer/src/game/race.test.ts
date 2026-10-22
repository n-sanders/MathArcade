import { describe, expect, it } from 'vitest';
import { GRAND_PRIX, HULL } from './config';
import { answerQuestion, createRace, tick, type RaceState } from './race';
import { buildFamilySetup, buildGrandPrixSetup, inputModeForRank } from './setups';

const right = (s: RaceState) => answerQuestion(s, s.current.answer);
const wrong = (s: RaceState) => answerQuestion(s, s.current.answer + 1);

describe('practice round', () => {
  it('finishes after 20 answers even with a few mistakes', () => {
    let s = createRace(buildFamilySetup('practice', 4, 'C'));
    for (let i = 0; i < 20; i++) s = i % 5 === 0 ? wrong(s) : right(s);
    expect(s.status).toBe('finished');
    expect(s.wrong).toBe(4);
  });

  it('crashes on three quick wrong answers', () => {
    let s = createRace(buildFamilySetup('practice', 4, 'C'));
    s = wrong(wrong(wrong(s)));
    expect(s.status).toBe('crashed');
  });

  it('survives mistakes that are spread out because correct answers repair the hull', () => {
    let s = createRace(buildFamilySetup('practice', 4, 'C'));
    for (let i = 0; i < 18; i++) s = i % 6 === 0 ? wrong(s) : right(s);
    expect(s.status).toBe('running');
    expect(s.hull).toBeGreaterThan(0);
  });

  it('never repairs past full hull', () => {
    let s = createRace(buildFamilySetup('practice', 4, 'C'));
    s = right(right(s));
    expect(s.hull).toBe(HULL.max);
  });
});

describe('graduation check', () => {
  it('fails on the first wrong answer', () => {
    let s = createRace(buildFamilySetup('graduation', 3, 'C'));
    s = wrong(right(s));
    expect(s.status).toBe('failed');
  });

  it('passes with 20 correct inside the time limit', () => {
    let s = createRace(buildFamilySetup('graduation', 3, 'C'));
    for (let i = 0; i < 20; i++) s = right(tick(s, i * 1000));
    expect(s.status).toBe('finished');
  });

  it('times out', () => {
    const s = tick(createRace(buildFamilySetup('graduation', 3, 'C')), 200_000);
    expect(s.status).toBe('timeout');
  });
});

describe('rival race', () => {
  it('re-queues missed facts so the course still needs 20 correct', () => {
    let s = createRace(buildFamilySetup('rival', 6, 'B'));
    const missed = s.current;
    s = wrong(s);
    expect(s.progress).toBe(0);
    expect(s.queue).toContain(missed);
    for (let i = 0; i < 20; i++) s = right(s);
    expect(s.status).toBe('finished');
  });

  it('is lost when the rival reaches the finish first', () => {
    const setup = buildFamilySetup('rival', 6, 'B');
    const s = tick(createRace(setup), setup.rivals[0].finishMs);
    expect(s.status).toBe('beaten');
  });

  it('gets faster rivals at higher ranks', () => {
    const b = buildFamilySetup('rival', 6, 'B').rivals[0].finishMs;
    const a = buildFamilySetup('rival', 6, 'A').rivals[0].finishMs;
    const sRank = buildFamilySetup('rival', 6, 'S').rivals[0].finishMs;
    expect(a).toBeLessThan(b);
    expect(sRank).toBeLessThan(a);
  });
});

describe('inputModeForRank', () => {
  it('fades scaffolding from chart to multiples, mixed choices, then typing', () => {
    expect(inputModeForRank('C')).toBe('numberline');
    expect(inputModeForRank('B')).toBe('choices-multiples');
    expect(inputModeForRank('A')).toBe('choices-mixed');
    expect(inputModeForRank('S')).toBe('keypad');
  });

  it('keeps graduation on the chart and rival races on the rank input', () => {
    expect(buildFamilySetup('graduation', 3, 'C').inputMode).toBe('numberline');
    expect(buildFamilySetup('rival', 3, 'B').inputMode).toBe('choices-multiples');
    expect(buildGrandPrixSetup([2, 3, 4, 5]).inputMode).toBe('choices-mixed');
  });
});

describe('grand prix', () => {
  it('needs 40 correct inside 60 seconds', () => {
    let s = createRace(buildGrandPrixSetup([2, 3, 4, 5]));
    for (let i = 0; i < GRAND_PRIX.targetCorrect; i++) s = right(tick(s, i * 1000));
    expect(s.status).toBe('finished');
  });

  it('times out at 60 seconds rather than losing to a rival', () => {
    const s = tick(createRace(buildGrandPrixSetup([2, 3, 4, 5])), GRAND_PRIX.durationMs);
    expect(s.status).toBe('timeout');
  });

  it('only asks facts from the selected families', () => {
    let s = createRace(buildGrandPrixSetup([2, 9, 11, 12]));
    for (let i = 0; i < 30; i++) {
      expect([2, 9, 11, 12]).toContain(s.current.family);
      s = right(s);
    }
  });
});
