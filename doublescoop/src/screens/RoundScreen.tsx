import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { sfx } from '../audio/sound';
import { Cone, Confetti, MiniCone, pickFlavor, type ConeState, type Flavor } from '../components/Cone';
import { Keypad } from '../components/Keypad';
import { FINISH_MS, RANK_RULES, SCOOPS_PER_CONE, TOPPLE_MS } from '../game/config';
import { buildRound, formatProblem } from '../game/problems';
import { answer, createRound, currentProblem, summarize, type RoundResult } from '../game/round';
import type { Problem, Rank, RoundMode } from '../game/types';
import { roundTitle } from './labels';

interface Props {
  rank: Rank;
  mode: RoundMode;
  onFinish: (result: RoundResult) => void;
  onQuit: () => void;
}

type Anim = { kind: 'finish'; top: Flavor } | { kind: 'topple'; problem: Problem; given: number | null };

const END_HOLD_MS = 2200;

export function RoundScreen({ rank, mode, onFinish, onQuit }: Props) {
  const [round, setRound] = useState(() => createRound(rank, mode, buildRound(rank)));
  const [phase, setPhase] = useState<'countdown' | 'playing' | 'done'>('countdown');
  const [count, setCount] = useState(3);
  const [scoops, setScoops] = useState<Flavor[]>([]);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [coneId, setConeId] = useState(0);
  const [served, setServed] = useState<Flavor[]>([]);
  const [lastProblem, setLastProblem] = useState<Problem | null>(null);
  const [popup, setPopup] = useState<{ id: number; text: string } | null>(null);
  const [now, setNow] = useState(0);
  const questionStart = useRef(0);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const timeLimit = RANK_RULES[rank].timeLimitMs;
  const locked = phase !== 'playing' || anim !== null || round.status !== 'playing';

  // Countdown: 3, 2, 1, Scoop!
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) {
      sfx.go();
      questionStart.current = performance.now();
      setPhase('playing');
      return;
    }
    sfx.beep();
    const t = setTimeout(() => setCount((c) => c - 1), 750);
    return () => clearTimeout(t);
  }, [phase, count]);

  const handleAnswer = useCallback(
    (given: number | null) => {
      if (locked) return;
      const problem = currentProblem(round);
      if (!problem) return;
      const elapsed = performance.now() - questionStart.current;
      const next = answer(round, given, elapsed);
      setRound(next);
      setLastProblem(problem);
      questionStart.current = performance.now();

      if (next.lastEvent === 'topple') {
        sfx.topple();
        setAnim({ kind: 'topple', problem, given });
        return;
      }
      const flavor = pickFlavor(scoops);
      sfx.scoop(scoops.length);
      setScoops((s) => [...s, flavor]);
      setPopup({ id: next.index, text: `+${next.lastPoints}` });
      if (next.lastEvent === 'cone') {
        setTimeout(() => sfx.coneDone(), 420);
        setAnim({ kind: 'finish', top: flavor });
      }
    },
    [locked, round, scoops],
  );

  // Hold the fanfare / topple, then bring out a fresh cone.
  useEffect(() => {
    if (!anim) return;
    const t = setTimeout(
      () => {
        if (anim.kind === 'finish') setServed((s) => [...s, anim.top]);
        setScoops([]);
        setConeId((id) => id + 1);
        setAnim(null);
        questionStart.current = performance.now();
      },
      anim.kind === 'finish' ? FINISH_MS : TOPPLE_MS,
    );
    return () => clearTimeout(t);
  }, [anim]);

  // Rank S per-question timer; running out counts as a miss.
  const answerRef = useRef(handleAnswer);
  answerRef.current = handleAnswer;
  useEffect(() => {
    if (timeLimit === null || locked) return;
    let frame = 0;
    const loop = () => {
      const t = performance.now();
      setNow(t);
      if (t - questionStart.current >= timeLimit) {
        answerRef.current(null);
        return;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [timeLimit, locked, round.index]);

  // Round end, once the last cone animation has played out.
  const endedRef = useRef(false);
  useEffect(() => {
    if (round.status === 'playing' || anim || endedRef.current) return;
    endedRef.current = true;
    setPhase('done');
    const result = summarize(round);
    if (result.passed) sfx.win();
    else sfx.lose();
    const t = setTimeout(() => finishRef.current(result), END_HOLD_MS);
    return () => clearTimeout(t);
  }, [round, anim]);

  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(null), 800);
    return () => clearTimeout(t);
  }, [popup]);

  const coneState: ConeState = anim?.kind ?? 'idle';
  const current = currentProblem(round);
  const showSolved = anim?.kind === 'finish' || (!current && lastProblem);
  const shown = anim?.kind === 'topple' ? anim.problem : showSolved ? lastProblem : current;
  const shownAnswer = anim?.kind === 'topple' || showSolved ? shown?.answer : null;
  const reveal = anim?.kind === 'topple' ? { correct: anim.problem.answer, given: anim.given } : null;
  const timedOut = anim?.kind === 'topple' && anim.given === null;

  const timeLeftFrac =
    timeLimit === null || locked ? 1 : Math.max(0, 1 - (now - questionStart.current) / timeLimit);
  const questionNumber = Math.min(round.index + 1, round.problems.length);

  let overlay: ReactNode = null;
  if (phase === 'countdown') {
    overlay = (
      <div className="countdown" key={count}>
        {count || 'Scoop!'}
      </div>
    );
  } else if (phase === 'done') {
    const passed = summarize(round).passed;
    const text =
      mode === 'test' ? (passed ? 'Test Passed!' : 'Test Missed') : 'Round Complete!';
    overlay = <div className={`end-banner ${passed ? 'good' : 'bad'}`}>{text}</div>;
  }

  return (
    <div className={`round-screen mode-${mode}`}>
      <header className="round-top">
        <button type="button" className="btn ghost" onClick={onQuit}>
          ◂ Parlor
        </button>
        <div className="round-title">
          <h2>{roundTitle(rank, mode)}</h2>
          <p>{mode === 'test' ? 'Perfect scoops only: one miss ends the test' : 'Five in a row finishes a cone'}</p>
        </div>
        <div className="round-stats">
          <div className="stat">
            <span className="hud-label">Question</span>
            <span className="stat-value">
              {questionNumber}/{round.problems.length}
            </span>
          </div>
          <div className="stat">
            <span className="hud-label">Score</span>
            <span className="stat-value">{round.score}</span>
          </div>
          <div className={`stat ${round.streak >= 5 ? 'hot' : ''}`}>
            <span className="hud-label">Streak</span>
            <span className="stat-value">{round.streak}</span>
          </div>
          <span className={`rank-badge rank-${rank}`}>{rank}</span>
        </div>
      </header>

      <div className="round-main">
        <section className="question-deck">
          {timeLimit !== null && (
            <div className={`drip-timer ${timeLeftFrac < 0.34 ? 'low' : ''}`} aria-label="Time left">
              <span style={{ width: `${timeLeftFrac * 100}%` }} />
            </div>
          )}
          <div className={`question ${anim?.kind === 'topple' ? 'is-wrong' : ''}`} key={round.index}>
            <span className="q-fact">{shown ? formatProblem(shown) : '\u00a0'}</span>
            <span className="q-eq">=</span>
            <span className={`q-answer ${showSolved ? 'is-solved' : ''}`}>{shownAnswer ?? '?'}</span>
          </div>
          {timedOut && <p className="timeout-note">Melted! Out of time.</p>}
          <div className="answer-area">
            <Keypad onSubmit={handleAnswer} disabled={locked} reveal={reveal} resetKey={round.index} />
          </div>
        </section>

        <section className="cone-stage">
          <div className="served" aria-label={`${served.length} cones served`}>
            <span className="hud-label">Served</span>
            <div className="served-row">
              {served.length === 0 ? (
                <span className="served-empty">none yet</span>
              ) : (
                served.map((f, i) => <MiniCone key={i} flavor={f} />)
              )}
            </div>
          </div>
          <div className="cone-pips" aria-hidden>
            {Array.from({ length: SCOOPS_PER_CONE }, (_, i) => (
              <span key={i} className={i < scoops.length ? 'on' : ''} />
            ))}
          </div>
          <Cone key={coneId} scoops={scoops} state={coneState} />
          {anim?.kind === 'finish' && (
            <>
              <Confetti />
              <div className="cone-banner">Cone complete!</div>
            </>
          )}
          {popup && (
            <div className="points-pop" key={popup.id}>
              {popup.text}
            </div>
          )}
          <div className="counter-top" aria-hidden />
          {overlay}
        </section>
      </div>
    </div>
  );
}
