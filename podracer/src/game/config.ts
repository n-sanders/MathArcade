import type { Rank } from './types';

export const FAMILIES: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const MULTIPLIERS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Each fact appears this many times per round (10 multipliers × 2 = 20 questions). */
export const ROUND_REPEATS = 2;

export const LAPS = 3;

/**
 * Hull tuning. Three wrong answers close together (with fewer than ~2 correct answers
 * between them) take the hull from full to zero; steady correct answers repair it.
 */
export const HULL = {
  max: 100,
  wrongDamage: 35,
  correctRepair: 8,
} as const;

export const PRACTICE_ROUNDS_TO_GRADUATE = 3;

/** Time limit for the Rank C graduation check (20 questions, 100% accuracy). */
export const GRADUATION_TIME_MS = 100_000;

/** Rival race wins needed at a rank before ranking up. S is the top rank. */
export const RACE_WINS_TO_RANK_UP: Record<Rank, number | null> = {
  C: null,
  B: 3,
  A: 3,
  S: null,
};

/** Rival pace: seconds per question of the 20-question course. */
export const RIVAL_SECONDS_PER_QUESTION: Record<Rank, number> = {
  C: 6,
  B: 6,
  A: 4.5,
  S: 3.5,
};

/** When a rival-race answer is wrong, the fact comes back this many questions later. */
export const REQUEUE_GAP = 3;

export const GRAND_PRIX = {
  durationMs: 60_000,
  targetCorrect: 40,
  minFamilies: 4,
  familiesAtRankAToUnlock: 4,
} as const;

/** How long a wrong answer's correction stays on screen (input is locked meanwhile). */
export const REVEAL_MS = {
  numberline: 1200,
  standard: 900,
  grandprix: 650,
} as const;
