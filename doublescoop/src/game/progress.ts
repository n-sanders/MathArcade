import { ROUNDS_TO_TEST } from './config';
import type { RoundResult } from './round';
import { RANK_ORDER, type Rank } from './types';

export const SAVE_KEY = 'double-scoop/save/v1';

export interface SaveData {
  version: 1;
  rank: Rank;
  /** Completed normal rounds at the current rank (caps at ROUNDS_TO_TEST). Resets on rank up. */
  roundsAtRank: number;
  testAttempts: number;
  bestScore: number;
  stats: {
    roundsPlayed: number;
    totalCorrect: number;
    totalAnswered: number;
    bestStreak: number;
  };
  settings: { muted: boolean };
}

export type ProgressEvent =
  | { type: 'roundLogged'; count: number; needed: number }
  | { type: 'testUnlocked'; rank: Rank }
  | { type: 'rankUp'; from: Rank; to: Rank }
  | { type: 'testFailed'; rank: Rank }
  | { type: 'newBest'; score: number };

export function defaultSave(): SaveData {
  return {
    version: 1,
    rank: 'C',
    roundsAtRank: 0,
    testAttempts: 0,
    bestScore: 0,
    stats: { roundsPlayed: 0, totalCorrect: 0, totalAnswered: 0, bestStreak: 0 },
    settings: { muted: false },
  };
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function loadSave(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): SaveData {
  let raw: unknown;
  try {
    const text = storage?.getItem(SAVE_KEY);
    raw = text ? JSON.parse(text) : undefined;
  } catch {
    raw = undefined;
  }
  return parseSave(raw);
}

/** Sanitizes an already-parsed save object, filling in defaults for anything missing or invalid. */
export function parseSave(raw: unknown): SaveData {
  const save = defaultSave();
  if (!raw || typeof raw !== 'object') return save;
  const data = raw as Partial<SaveData>;
  if (RANK_ORDER.includes(data.rank as Rank)) save.rank = data.rank as Rank;
  save.roundsAtRank = Math.min(ROUNDS_TO_TEST, Math.floor(num(data.roundsAtRank, 0)));
  save.testAttempts = num(data.testAttempts, 0);
  save.bestScore = num(data.bestScore, 0);
  if (data.stats && typeof data.stats === 'object') {
    save.stats = {
      roundsPlayed: num(data.stats.roundsPlayed, 0),
      totalCorrect: num(data.stats.totalCorrect, 0),
      totalAnswered: num(data.stats.totalAnswered, 0),
      bestStreak: num(data.stats.bestStreak, 0),
    };
  }
  if (data.settings && typeof data.settings === 'object') save.settings.muted = data.settings.muted === true;
  return save;
}

export function writeSave(save: SaveData, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage full or blocked (private mode) — progress just won't persist.
  }
}

export function isTopRank(rank: Rank): boolean {
  return rank === RANK_ORDER[RANK_ORDER.length - 1];
}

export function nextRank(rank: Rank): Rank {
  return RANK_ORDER[Math.min(RANK_ORDER.length - 1, RANK_ORDER.indexOf(rank) + 1)];
}

export function canTakeTest(save: SaveData): boolean {
  return !isTopRank(save.rank) && save.roundsAtRank >= ROUNDS_TO_TEST;
}

/** True once anything has been played, so an untouched default save is never pushed. */
export function hasProgress(save: SaveData): boolean {
  const blank = defaultSave();
  return JSON.stringify({ ...save, settings: blank.settings }) !== JSON.stringify(blank);
}

export function applyResult(save: SaveData, result: RoundResult): { save: SaveData; events: ProgressEvent[] } {
  const events: ProgressEvent[] = [];
  const next: SaveData = {
    ...save,
    stats: {
      roundsPlayed: save.stats.roundsPlayed + (result.mode === 'round' && result.passed ? 1 : 0),
      totalCorrect: save.stats.totalCorrect + result.correct,
      totalAnswered: save.stats.totalAnswered + result.answered,
      bestStreak: Math.max(save.stats.bestStreak, result.bestStreak),
    },
  };

  if (result.score > save.bestScore) {
    next.bestScore = result.score;
    if (save.bestScore > 0) events.push({ type: 'newBest', score: result.score });
  }

  // Results from a rank the player has already left (or not reached) don't move progression.
  if (result.rank !== save.rank) return { save: next, events };

  if (result.mode === 'round') {
    if (result.passed && !isTopRank(save.rank) && save.roundsAtRank < ROUNDS_TO_TEST) {
      next.roundsAtRank = save.roundsAtRank + 1;
      events.push({ type: 'roundLogged', count: next.roundsAtRank, needed: ROUNDS_TO_TEST });
      if (next.roundsAtRank === ROUNDS_TO_TEST) events.push({ type: 'testUnlocked', rank: save.rank });
    }
    return { save: next, events };
  }

  if (!canTakeTest(save)) return { save: next, events };
  next.testAttempts = save.testAttempts + 1;
  if (result.passed) {
    next.rank = nextRank(save.rank);
    next.roundsAtRank = 0;
    events.push({ type: 'rankUp', from: save.rank, to: next.rank });
  } else {
    events.push({ type: 'testFailed', rank: save.rank });
  }
  return { save: next, events };
}
