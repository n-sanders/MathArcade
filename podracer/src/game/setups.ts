import {
  GRADUATION_TIME_MS,
  GRAND_PRIX,
  LAPS,
  MULTIPLIERS,
  RIVAL_SECONDS_PER_QUESTION,
  ROUND_REPEATS,
} from './config';
import { buildRoundQuestions } from './facts';
import type { RaceSetup } from './race';
import { rivalForFamily } from './characters';
import type { FamilyActivity, InputMode, Rank, Rng } from './types';

const ROUND_LENGTH = MULTIPLIERS.length * ROUND_REPEATS;

export function inputModeForRank(rank: Rank): InputMode {
  switch (rank) {
    case 'C':
      return 'numberline';
    case 'B':
      return 'choices-multiples';
    case 'A':
      return 'choices-mixed';
    case 'S':
      return 'keypad';
  }
}

export function buildFamilySetup(
  activity: FamilyActivity,
  family: number,
  rank: Rank,
  rng: Rng = Math.random,
): RaceSetup {
  const base: RaceSetup = {
    mode: activity,
    families: [family],
    inputMode: inputModeForRank(rank),
    questions: buildRoundQuestions(family, rng),
    endless: false,
    targetSegments: ROUND_LENGTH,
    timeLimitMs: null,
    rivals: [],
    advanceOnWrong: false,
    requeueOnWrong: false,
    failOnWrong: false,
    laps: LAPS,
  };

  switch (activity) {
    case 'practice':
    case 'review':
      return { ...base, advanceOnWrong: true };
    case 'graduation':
      return { ...base, inputMode: 'numberline', timeLimitMs: GRADUATION_TIME_MS, failOnWrong: true };
    case 'rival': {
      const raceRank: Rank = rank === 'C' ? 'B' : rank;
      const finishMs = ROUND_LENGTH * RIVAL_SECONDS_PER_QUESTION[raceRank] * 1000;
      return {
        ...base,
        inputMode: inputModeForRank(raceRank),
        requeueOnWrong: true,
        rivals: [{ rivalId: rivalForFamily(family).id, finishMs }],
      };
    }
  }
}

export function buildGrandPrixSetup(families: number[]): RaceSetup {
  // Rivals cross the line just after the clock runs out, so the 40-correct goal is what decides
  // the race; they exist to show the pace the student has to beat.
  const rivals = families.map((f, i) => ({
    rivalId: rivalForFamily(f).id,
    finishMs: GRAND_PRIX.durationMs + 800 + i * 900,
  }));
  return {
    mode: 'grandprix',
    families: [...families],
    inputMode: 'choices-mixed',
    questions: [],
    endless: true,
    targetSegments: GRAND_PRIX.targetCorrect,
    timeLimitMs: GRAND_PRIX.durationMs,
    rivals,
    advanceOnWrong: false,
    requeueOnWrong: false,
    failOnWrong: false,
    laps: LAPS,
  };
}
