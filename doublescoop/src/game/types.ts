export type Rank = 'C' | 'B' | 'A' | 'S';

export const RANK_ORDER: readonly Rank[] = ['C', 'B', 'A', 'S'];

/** `near1` / `near2` are near doubles whose addends differ by 1 or 2 (6 + 7, 6 + 8). */
export type ProblemKind = 'double' | 'near1' | 'near2';

export interface Problem {
  a: number;
  b: number;
  answer: number;
  kind: ProblemKind;
}

/** A normal round counts toward the rank-up test; a test needs 100% to promote. */
export type RoundMode = 'round' | 'test';
