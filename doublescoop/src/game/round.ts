import { CONE_BONUS, POINTS_PER_STREAK, SCOOPS_PER_CONE, STREAK_CAP } from './config';
import type { Problem, Rank, RoundMode } from './types';

export type RoundStatus = 'playing' | 'finished' | 'failed';

/** What the last answer did to the cone, for the scoop / fanfare / topple animations. */
export type ConeEvent = 'scoop' | 'cone' | 'topple';

export interface RoundState {
  rank: Rank;
  mode: RoundMode;
  problems: Problem[];
  index: number;
  streak: number;
  bestStreak: number;
  /** Scoops on the current cone (0 to SCOOPS_PER_CONE - 1; a full cone is served and reset). */
  coneScoops: number;
  conesCompleted: number;
  score: number;
  correct: number;
  wrong: number;
  answerTimesMs: number[];
  misses: { problem: Problem; given: number | null }[];
  status: RoundStatus;
  lastEvent: ConeEvent | null;
  lastPoints: number;
}

export interface RoundResult {
  rank: Rank;
  mode: RoundMode;
  status: Exclude<RoundStatus, 'playing'>;
  /** A normal round counts once played to the end; a test also needs zero misses. */
  passed: boolean;
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  accuracy: number;
  avgMs: number;
  bestStreak: number;
  conesCompleted: number;
  score: number;
  misses: { problem: Problem; given: number | null }[];
}

export function createRound(rank: Rank, mode: RoundMode, problems: Problem[]): RoundState {
  return {
    rank,
    mode,
    problems,
    index: 0,
    streak: 0,
    bestStreak: 0,
    coneScoops: 0,
    conesCompleted: 0,
    score: 0,
    correct: 0,
    wrong: 0,
    answerTimesMs: [],
    misses: [],
    status: problems.length ? 'playing' : 'finished',
    lastEvent: null,
    lastPoints: 0,
  };
}

export function currentProblem(state: RoundState): Problem | undefined {
  return state.problems[state.index];
}

export function pointsForStreak(streak: number): number {
  return POINTS_PER_STREAK * Math.min(streak, STREAK_CAP);
}

/** Records an answer; `given` is null when the timer ran out. */
export function answer(state: RoundState, given: number | null, elapsedMs: number): RoundState {
  const problem = currentProblem(state);
  if (state.status !== 'playing' || !problem) return state;

  const next: RoundState = {
    ...state,
    index: state.index + 1,
    answerTimesMs: [...state.answerTimesMs, Math.max(0, elapsedMs)],
  };

  if (given === problem.answer) {
    next.correct++;
    next.streak++;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
    let points = pointsForStreak(next.streak);
    next.coneScoops++;
    if (next.coneScoops >= SCOOPS_PER_CONE) {
      next.coneScoops = 0;
      next.conesCompleted++;
      points += CONE_BONUS;
      next.lastEvent = 'cone';
    } else {
      next.lastEvent = 'scoop';
    }
    next.score += points;
    next.lastPoints = points;
  } else {
    next.wrong++;
    next.streak = 0;
    next.coneScoops = 0;
    next.misses = [...state.misses, { problem, given }];
    next.lastEvent = 'topple';
    next.lastPoints = 0;
    if (state.mode === 'test') next.status = 'failed';
  }

  if (next.status === 'playing' && next.index >= next.problems.length) next.status = 'finished';
  return next;
}

export function summarize(state: RoundState): RoundResult {
  const answered = state.correct + state.wrong;
  const totalMs = state.answerTimesMs.reduce((sum, ms) => sum + ms, 0);
  const status = state.status === 'playing' ? 'failed' : state.status;
  return {
    rank: state.rank,
    mode: state.mode,
    status,
    passed: status === 'finished' && (state.mode === 'round' || state.wrong === 0),
    total: state.problems.length,
    answered,
    correct: state.correct,
    wrong: state.wrong,
    accuracy: answered ? state.correct / answered : 0,
    avgMs: state.answerTimesMs.length ? totalMs / state.answerTimesMs.length : 0,
    bestStreak: state.bestStreak,
    conesCompleted: state.conesCompleted,
    score: state.score,
    misses: state.misses,
  };
}
