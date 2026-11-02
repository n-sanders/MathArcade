import type { ProblemKind, Rank } from './types';

export const MIN_ADDEND = 1;
export const MAX_ADDEND = 10;

export interface RankRules {
  questions: number;
  /** Share of each problem kind in a round; shares sum to 1. */
  mix: Record<ProblemKind, number>;
  /** Per-question time limit, or null when untimed. */
  timeLimitMs: number | null;
}

export const RANK_RULES: Record<Rank, RankRules> = {
  C: { questions: 20, mix: { double: 1, near1: 0, near2: 0 }, timeLimitMs: null },
  B: { questions: 25, mix: { double: 0.4, near1: 0.6, near2: 0 }, timeLimitMs: null },
  A: { questions: 30, mix: { double: 0.3, near1: 0.35, near2: 0.35 }, timeLimitMs: null },
  S: { questions: 35, mix: { double: 0.3, near1: 0.35, near2: 0.35 }, timeLimitMs: 6_000 },
};

/** Correct answers in a row that finish a cone. */
export const SCOOPS_PER_CONE = 5;

/** Completed normal rounds at a rank before the rank-up test unlocks. */
export const ROUNDS_TO_TEST = 2;

/** A correct answer scores POINTS_PER_STREAK × the current streak, with the streak capped at STREAK_CAP. */
export const POINTS_PER_STREAK = 10;
export const STREAK_CAP = 10;
export const CONE_BONUS = 50;

/** How long the topple + correct-answer reveal holds input after a miss. */
export const TOPPLE_MS = 1300;

/** How long the finished-cone fanfare holds input before a fresh cone slides in. */
export const FINISH_MS = 1700;
