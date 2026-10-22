import { FAMILIES, GRAND_PRIX, PRACTICE_ROUNDS_TO_GRADUATE, RACE_WINS_TO_RANK_UP } from './config';
import type { Fact, FamilyActivity, Launch, Rank } from './types';
import type { RaceStatus } from './race';

export const SAVE_KEY = 'multiplication-pod-racer/save/v1';

export interface FamilyProgress {
  family: number;
  rank: Rank;
  /** Successful Rank C practice rounds (caps at PRACTICE_ROUNDS_TO_GRADUATE). */
  practiceRounds: number;
  /** Set after a failed graduation check; cleared by finishing one review round. */
  needsReview: boolean;
  /** Rival wins at the current rank. Resets on rank up. */
  raceWins: number;
  racesRun: number;
  graduationAttempts: number;
  bestRaceMs: number | null;
}

export interface SaveData {
  version: 1;
  families: Record<string, FamilyProgress>;
  grandPrix: { attempts: number; wins: number; bestCorrect: number };
  settings: { muted: boolean };
}

export interface RaceResult {
  status: RaceStatus;
  won: boolean;
  elapsedMs: number;
  correct: number;
  wrong: number;
  misses: Fact[];
}

export type ProgressEvent =
  | { type: 'practiceLogged'; family: number; count: number; needed: number }
  | { type: 'graduationUnlocked'; family: number }
  | { type: 'reviewRequired'; family: number }
  | { type: 'reviewCleared'; family: number }
  | { type: 'rankUp'; family: number; from: Rank; to: Rank }
  | { type: 'raceWin'; family: number; wins: number; needed: number | null }
  | { type: 'newBest'; family: number; ms: number }
  | { type: 'grandPrixUnlocked' }
  | { type: 'grandPrixWin'; correct: number };

export function defaultFamilyProgress(family: number): FamilyProgress {
  return {
    family,
    rank: 'C',
    practiceRounds: 0,
    needsReview: false,
    raceWins: 0,
    racesRun: 0,
    graduationAttempts: 0,
    bestRaceMs: null,
  };
}

export function defaultSave(): SaveData {
  const families: Record<string, FamilyProgress> = {};
  for (const f of FAMILIES) families[f] = defaultFamilyProgress(f);
  return {
    version: 1,
    families,
    grandPrix: { attempts: 0, wins: 0, bestCorrect: 0 },
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

const RANKS: readonly string[] = ['C', 'B', 'A', 'S'];

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Loads the save, tolerating missing/corrupt data and filling in any new families. */
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

  for (const f of FAMILIES) {
    const stored = data.families?.[f] as Partial<FamilyProgress> | undefined;
    if (!stored) continue;
    const base = save.families[f];
    save.families[f] = {
      family: f,
      rank: RANKS.includes(stored.rank as string) ? (stored.rank as Rank) : base.rank,
      practiceRounds: num(stored.practiceRounds, 0),
      needsReview: stored.needsReview === true,
      raceWins: num(stored.raceWins, 0),
      racesRun: num(stored.racesRun, 0),
      graduationAttempts: num(stored.graduationAttempts, 0),
      bestRaceMs: typeof stored.bestRaceMs === 'number' ? stored.bestRaceMs : null,
    };
  }
  if (data.grandPrix) {
    save.grandPrix = {
      attempts: num(data.grandPrix.attempts, 0),
      wins: num(data.grandPrix.wins, 0),
      bestCorrect: num(data.grandPrix.bestCorrect, 0),
    };
  }
  if (data.settings) save.settings.muted = data.settings.muted === true;
  return save;
}

export function writeSave(save: SaveData, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage full or blocked (private mode) — progress just won't persist.
  }
}

export function getFamily(save: SaveData, family: number): FamilyProgress {
  return save.families[family] ?? defaultFamilyProgress(family);
}

export function nextActivity(fp: FamilyProgress): FamilyActivity {
  if (fp.rank !== 'C') return 'rival';
  if (fp.needsReview) return 'review';
  if (fp.practiceRounds >= PRACTICE_ROUNDS_TO_GRADUATE) return 'graduation';
  return 'practice';
}

export function rankAtLeast(rank: Rank, min: Rank): boolean {
  return RANKS.indexOf(rank) >= RANKS.indexOf(min);
}

export function familiesAtLeast(save: SaveData, min: Rank): number[] {
  return FAMILIES.filter((f) => rankAtLeast(getFamily(save, f).rank, min));
}

export function isGrandPrixUnlocked(save: SaveData): boolean {
  return familiesAtLeast(save, 'A').length >= GRAND_PRIX.familiesAtRankAToUnlock;
}

function nextRank(rank: Rank): Rank {
  return (RANKS[Math.min(RANKS.length - 1, RANKS.indexOf(rank) + 1)] as Rank) ?? rank;
}

export function applyResult(
  save: SaveData,
  launch: Launch,
  result: RaceResult,
): { save: SaveData; events: ProgressEvent[] } {
  const events: ProgressEvent[] = [];
  const wasUnlocked = isGrandPrixUnlocked(save);
  const next: SaveData = {
    ...save,
    families: { ...save.families },
    grandPrix: { ...save.grandPrix },
  };

  if (launch.kind === 'grandprix') {
    next.grandPrix.attempts++;
    next.grandPrix.bestCorrect = Math.max(next.grandPrix.bestCorrect, result.correct);
    if (result.won) {
      next.grandPrix.wins++;
      events.push({ type: 'grandPrixWin', correct: result.correct });
    }
    return { save: next, events };
  }

  const { family, activity } = launch;
  const fp: FamilyProgress = { ...getFamily(save, family) };

  switch (activity) {
    case 'practice':
    case 'review': {
      if (!result.won || fp.rank !== 'C') break;
      if (fp.needsReview) {
        fp.needsReview = false;
        events.push({ type: 'reviewCleared', family });
      } else if (fp.practiceRounds < PRACTICE_ROUNDS_TO_GRADUATE) {
        fp.practiceRounds++;
        events.push({
          type: 'practiceLogged',
          family,
          count: fp.practiceRounds,
          needed: PRACTICE_ROUNDS_TO_GRADUATE,
        });
        if (fp.practiceRounds === PRACTICE_ROUNDS_TO_GRADUATE) events.push({ type: 'graduationUnlocked', family });
      }
      break;
    }
    case 'graduation': {
      if (fp.rank !== 'C') break;
      fp.graduationAttempts++;
      if (result.won) {
        fp.rank = 'B';
        fp.raceWins = 0;
        fp.needsReview = false;
        events.push({ type: 'rankUp', family, from: 'C', to: 'B' });
      } else {
        fp.needsReview = true;
        events.push({ type: 'reviewRequired', family });
      }
      break;
    }
    case 'rival': {
      fp.racesRun++;
      if (!result.won) break;
      if (fp.bestRaceMs === null || result.elapsedMs < fp.bestRaceMs) {
        if (fp.bestRaceMs !== null) events.push({ type: 'newBest', family, ms: result.elapsedMs });
        fp.bestRaceMs = result.elapsedMs;
      }
      fp.raceWins++;
      const needed = RACE_WINS_TO_RANK_UP[fp.rank];
      if (needed !== null && fp.raceWins >= needed) {
        const from = fp.rank;
        fp.rank = nextRank(fp.rank);
        fp.raceWins = 0;
        events.push({ type: 'rankUp', family, from, to: fp.rank });
      } else {
        events.push({ type: 'raceWin', family, wins: fp.raceWins, needed });
      }
      break;
    }
  }

  next.families[family] = fp;
  if (!wasUnlocked && isGrandPrixUnlocked(next)) events.push({ type: 'grandPrixUnlocked' });
  return { save: next, events };
}
