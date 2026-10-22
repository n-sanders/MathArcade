import { describe, expect, it } from 'vitest';
import {
  applyResult,
  defaultSave,
  getFamily,
  isGrandPrixUnlocked,
  loadSave,
  nextActivity,
  SAVE_KEY,
  type RaceResult,
  type SaveData,
} from './progress';
import type { FamilyActivity } from './types';

const win: RaceResult = { status: 'finished', won: true, elapsedMs: 50_000, correct: 20, wrong: 0, misses: [] };
const loss: RaceResult = { status: 'crashed', won: false, elapsedMs: 20_000, correct: 5, wrong: 3, misses: [] };

function run(save: SaveData, family: number, activity: FamilyActivity, result: RaceResult) {
  return applyResult(save, { kind: 'family', family, activity }, result);
}

describe('Rank C progression', () => {
  it('needs 3 practice rounds before the graduation check', () => {
    let save = defaultSave();
    expect(nextActivity(getFamily(save, 4))).toBe('practice');
    save = run(save, 4, 'practice', win).save;
    save = run(save, 4, 'practice', loss).save;
    save = run(save, 4, 'practice', win).save;
    expect(nextActivity(getFamily(save, 4))).toBe('practice');
    const out = run(save, 4, 'practice', win);
    expect(out.events.some((e) => e.type === 'graduationUnlocked')).toBe(true);
    expect(nextActivity(getFamily(out.save, 4))).toBe('graduation');
  });

  it('failed check requires one review round, then the check again', () => {
    let save = defaultSave();
    for (let i = 0; i < 3; i++) save = run(save, 4, 'practice', win).save;
    save = run(save, 4, 'graduation', { ...win, status: 'failed', won: false }).save;
    expect(nextActivity(getFamily(save, 4))).toBe('review');
    save = run(save, 4, 'review', loss).save;
    expect(nextActivity(getFamily(save, 4))).toBe('review');
    save = run(save, 4, 'review', win).save;
    expect(nextActivity(getFamily(save, 4))).toBe('graduation');
  });

  it('passing the check promotes to Rank B and brings in the rival', () => {
    let save = defaultSave();
    for (let i = 0; i < 3; i++) save = run(save, 4, 'practice', win).save;
    const out = run(save, 4, 'graduation', win);
    expect(getFamily(out.save, 4).rank).toBe('B');
    expect(nextActivity(getFamily(out.save, 4))).toBe('rival');
  });
});

describe('rival ranks', () => {
  it('B → A → S after 3 wins each, tracked per family', () => {
    let save = defaultSave();
    save.families[5] = { ...getFamily(save, 5), rank: 'B' };
    for (let i = 0; i < 3; i++) save = run(save, 5, 'rival', win).save;
    expect(getFamily(save, 5).rank).toBe('A');
    save = run(save, 5, 'rival', loss).save;
    for (let i = 0; i < 3; i++) save = run(save, 5, 'rival', win).save;
    expect(getFamily(save, 5).rank).toBe('S');
    expect(getFamily(save, 6).rank).toBe('C');
  });
});

describe('grand prix unlock', () => {
  it('unlocks at 4 families at Rank A or better', () => {
    let save = defaultSave();
    for (const f of [2, 3, 4]) save.families[f] = { ...getFamily(save, f), rank: 'A' };
    expect(isGrandPrixUnlocked(save)).toBe(false);
    save.families[5] = { ...getFamily(save, 5), rank: 'B', raceWins: 2 };
    const out = run(save, 5, 'rival', win);
    expect(isGrandPrixUnlocked(out.save)).toBe(true);
    expect(out.events.some((e) => e.type === 'grandPrixUnlocked')).toBe(true);
  });
});

describe('loadSave', () => {
  it('falls back to defaults for missing or corrupt data', () => {
    expect(loadSave({ getItem: () => null })).toEqual(defaultSave());
    expect(loadSave({ getItem: () => '{not json' })).toEqual(defaultSave());
  });

  it('round-trips and sanitizes stored values', () => {
    const save = defaultSave();
    save.families[7] = { ...getFamily(save, 7), rank: 'A', raceWins: 1 };
    const stored = JSON.parse(JSON.stringify(save));
    stored.families[8].rank = 'Z';
    const loaded = loadSave({ getItem: (k) => (k === SAVE_KEY ? JSON.stringify(stored) : null) });
    expect(getFamily(loaded, 7).rank).toBe('A');
    expect(getFamily(loaded, 8).rank).toBe('C');
  });
});
