export type Rank = 'C' | 'B' | 'A' | 'S';

export const RANK_ORDER: readonly Rank[] = ['C', 'B', 'A', 'S'];

export interface Fact {
  family: number;
  multiplier: number;
  answer: number;
}

/**
 * How the student answers. Scaffolding fades as rank rises:
 * C = full skip-count chart, B = four choices that are all multiples of the family,
 * A = four choices with non-multiple distractors, S = typed answer.
 */
export type InputMode = 'numberline' | 'choices-multiples' | 'choices-mixed' | 'keypad';

export type ChoiceStyle = 'multiples' | 'mixed';

export type RaceMode = 'practice' | 'review' | 'graduation' | 'rival' | 'grandprix';

export type FamilyActivity = 'practice' | 'review' | 'graduation' | 'rival';

export type Launch =
  | { kind: 'family'; activity: FamilyActivity; family: number }
  | { kind: 'grandprix'; families: number[] };

export type Rng = () => number;
