import { describe, expect, it } from 'vitest';
import { applyResult, canTakeTest, defaultSave, hasProgress, loadSave, parseSave, SAVE_KEY, type SaveData } from './progress';
import type { RoundResult } from './round';
import type { Rank, RoundMode } from './types';

function result(rank: Rank, mode: RoundMode, passed: boolean, extra: Partial<RoundResult> = {}): RoundResult {
  return {
    rank,
    mode,
    status: passed ? 'finished' : 'failed',
    passed,
    total: 20,
    answered: 20,
    correct: passed ? 20 : 19,
    wrong: passed ? 0 : 1,
    accuracy: passed ? 1 : 0.95,
    avgMs: 2000,
    bestStreak: 10,
    conesCompleted: 4,
    score: 500,
    misses: [],
    ...extra,
  };
}

function play(save: SaveData, r: RoundResult) {
  return applyResult(save, r);
}

describe('rounds toward the test', () => {
  it('unlocks the test after two finished rounds', () => {
    let save = defaultSave();
    let out = play(save, result('C', 'round', true));
    expect(out.events).toEqual([{ type: 'roundLogged', count: 1, needed: 2 }]);
    expect(canTakeTest(out.save)).toBe(false);
    save = out.save;
    out = play(save, result('C', 'round', true, { score: 100 }));
    expect(out.events).toContainEqual({ type: 'testUnlocked', rank: 'C' });
    expect(canTakeTest(out.save)).toBe(true);
    out = play(out.save, result('C', 'round', true, { score: 100 }));
    expect(out.save.roundsAtRank).toBe(2);
    expect(out.events).toEqual([]);
  });

  it('ignores tests before they are unlocked', () => {
    const out = play(defaultSave(), result('C', 'test', true));
    expect(out.save.rank).toBe('C');
    expect(out.save.testAttempts).toBe(0);
  });
});

describe('rank-up test', () => {
  const ready = (rank: Rank): SaveData => ({ ...defaultSave(), rank, roundsAtRank: 2 });

  it('promotes on a perfect test and resets round count', () => {
    for (const [from, to] of [['C', 'B'], ['B', 'A'], ['A', 'S']] as const) {
      const out = play(ready(from), result(from, 'test', true));
      expect(out.save.rank).toBe(to);
      expect(out.save.roundsAtRank).toBe(0);
      expect(out.events).toContainEqual({ type: 'rankUp', from, to });
    }
  });

  it('keeps the rank and the unlocked test after a miss', () => {
    const out = play(ready('B'), result('B', 'test', false));
    expect(out.save.rank).toBe('B');
    expect(out.save.roundsAtRank).toBe(2);
    expect(out.save.testAttempts).toBe(1);
    expect(canTakeTest(out.save)).toBe(true);
    expect(out.events).toContainEqual({ type: 'testFailed', rank: 'B' });
  });

  it('has no test at the top rank', () => {
    const save = { ...defaultSave(), rank: 'S' as const };
    const out = play(save, result('S', 'round', true));
    expect(out.save.roundsAtRank).toBe(0);
    expect(canTakeTest({ ...save, roundsAtRank: 2 })).toBe(false);
  });
});

describe('best score and stats', () => {
  it('tracks best score and lifetime stats', () => {
    let out = play(defaultSave(), result('C', 'round', true, { score: 300 }));
    expect(out.save.bestScore).toBe(300);
    expect(out.events.some((e) => e.type === 'newBest')).toBe(false);
    out = play(out.save, result('C', 'round', true, { score: 400 }));
    expect(out.events).toContainEqual({ type: 'newBest', score: 400 });
    expect(out.save.stats.roundsPlayed).toBe(2);
    expect(out.save.stats.totalAnswered).toBe(40);
  });
});

describe('save parsing', () => {
  it('falls back to defaults for corrupt data', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('nope')).toEqual(defaultSave());
    const parsed = parseSave({ rank: 'Z', roundsAtRank: 99, bestScore: -5, stats: { roundsPlayed: 'x' } });
    expect(parsed.rank).toBe('C');
    expect(parsed.roundsAtRank).toBe(2);
    expect(parsed.bestScore).toBe(0);
    expect(parsed.stats.roundsPlayed).toBe(0);
  });

  it('loads from storage and survives bad JSON', () => {
    expect(loadSave({ getItem: () => '{bad' })).toEqual(defaultSave());
    const stored = { ...defaultSave(), rank: 'A', roundsAtRank: 1 };
    const loaded = loadSave({ getItem: (k: string) => (k === SAVE_KEY ? JSON.stringify(stored) : null) });
    expect(loaded.rank).toBe('A');
    expect(loaded.roundsAtRank).toBe(1);
  });

  it('only reports progress once something was played', () => {
    expect(hasProgress(defaultSave())).toBe(false);
    expect(hasProgress({ ...defaultSave(), settings: { muted: true } })).toBe(false);
    expect(hasProgress({ ...defaultSave(), bestScore: 10 })).toBe(true);
  });
});
