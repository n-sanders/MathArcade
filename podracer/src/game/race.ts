import { HULL, REQUEUE_GAP } from './config';
import { randomFact, sameFact } from './facts';
import type { Fact, InputMode, RaceMode, Rng } from './types';

export interface RivalEntry {
  rivalId: string;
  /** Elapsed time at which this rival crosses the finish line. */
  finishMs: number;
}

export interface RaceSetup {
  mode: RaceMode;
  families: number[];
  inputMode: InputMode;
  /** Initial question queue. Ignored when `endless`. */
  questions: Fact[];
  /** Draw random facts from `families` forever (Grand Prix). */
  endless: boolean;
  /** Course length, measured in pod advances. */
  targetSegments: number;
  timeLimitMs: number | null;
  rivals: RivalEntry[];
  /** Practice: every answer moves the pod, wrong ones just damage it. */
  advanceOnWrong: boolean;
  /** Races: a missed fact comes back a few questions later. */
  requeueOnWrong: boolean;
  /** Graduation check: one miss ends the attempt. */
  failOnWrong: boolean;
  laps: number;
}

export type RaceStatus = 'running' | 'finished' | 'crashed' | 'failed' | 'timeout' | 'beaten';

export interface AnswerRecord {
  fact: Fact;
  given: number;
  correct: boolean;
  atMs: number;
}

export interface RaceState {
  setup: RaceSetup;
  current: Fact;
  queue: Fact[];
  progress: number;
  correct: number;
  wrong: number;
  hull: number;
  streak: number;
  elapsedMs: number;
  status: RaceStatus;
  history: AnswerRecord[];
}

export function createRace(setup: RaceSetup, rng: Rng = Math.random): RaceState {
  const [first, ...rest] = setup.endless ? [randomFact(setup.families, rng)] : setup.questions;
  return {
    setup,
    current: first,
    queue: setup.endless ? [] : rest,
    progress: 0,
    correct: 0,
    wrong: 0,
    hull: HULL.max,
    streak: 0,
    elapsedMs: 0,
    status: 'running',
    history: [],
  };
}

export function damage(hull: number): number {
  return Math.max(0, hull - HULL.wrongDamage);
}

export function repair(hull: number): number {
  return Math.min(HULL.max, hull + HULL.correctRepair);
}

export function answerQuestion(state: RaceState, given: number, rng: Rng = Math.random): RaceState {
  if (state.status !== 'running') return state;
  const { setup, current } = state;
  const isCorrect = given === current.answer;
  const queue = [...state.queue];

  let { progress, correct, wrong, hull, streak } = state;
  if (isCorrect) {
    correct++;
    progress++;
    streak++;
    hull = repair(hull);
  } else {
    wrong++;
    streak = 0;
    hull = damage(hull);
    if (setup.advanceOnWrong) progress++;
    if (setup.requeueOnWrong && !setup.endless) {
      queue.splice(Math.min(REQUEUE_GAP, queue.length), 0, current);
    }
  }

  let status: RaceStatus = 'running';
  if (!isCorrect && setup.failOnWrong) status = 'failed';
  else if (hull <= 0) status = 'crashed';
  else if (progress >= setup.targetSegments) status = 'finished';

  let next = current;
  if (status === 'running') {
    const queued = setup.endless ? undefined : queue.shift();
    next = queued ?? randomFact(setup.families, rng, current);
  }

  return {
    ...state,
    current: next,
    queue,
    progress,
    correct,
    wrong,
    hull,
    streak,
    status,
    history: [...state.history, { fact: current, given, correct: isCorrect, atMs: state.elapsedMs }],
  };
}

export function tick(state: RaceState, elapsedMs: number): RaceState {
  if (state.status !== 'running') return state;
  const { timeLimitMs, rivals } = state.setup;
  let status: RaceStatus = 'running';
  if (timeLimitMs !== null && elapsedMs >= timeLimitMs) status = 'timeout';
  else if (rivals.some((r) => elapsedMs >= r.finishMs)) status = 'beaten';
  return { ...state, elapsedMs: timeLimitMs !== null ? Math.min(elapsedMs, timeLimitMs) : elapsedMs, status };
}

export function playerFraction(state: RaceState): number {
  return Math.min(1, state.progress / state.setup.targetSegments);
}

export function rivalFraction(rival: RivalEntry, elapsedMs: number): number {
  return Math.min(1, elapsedMs / rival.finishMs);
}

export function isWin(status: RaceStatus): boolean {
  return status === 'finished';
}

/** Unique facts missed during the race, in the order they were first missed. */
export function missedFacts(state: RaceState): Fact[] {
  const out: Fact[] = [];
  for (const rec of state.history) {
    if (!rec.correct && !out.some((f) => sameFact(f, rec.fact))) out.push(rec.fact);
  }
  return out;
}
