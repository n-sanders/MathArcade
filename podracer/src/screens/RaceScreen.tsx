import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setEngineIntensity, sfx, startEngine, stopEngine } from '../audio/sound';
import { ChoicePad, Keypad, NumberLine } from '../components/AnswerInputs';
import { CourseMap, type MapRacer } from '../components/CourseMap';
import { HullGauge } from '../components/HullGauge';
import type { Mood } from '../components/Portrait';
import { TauntPanel } from '../components/TauntPanel';
import { PIT_BOSS, PLAYER_POD, rivalById, type Character, type LineKey } from '../game/characters';
import { HULL, REVEAL_MS } from '../game/config';
import { choicesFor, formatFact } from '../game/facts';
import type { RaceResult } from '../game/progress';
import {
  answerQuestion,
  createRace,
  damage,
  isWin,
  missedFacts,
  playerFraction,
  rivalFraction,
  tick,
  type RaceSetup,
  type RaceStatus,
} from '../game/race';
import type { Track } from '../game/tracks';
import type { Fact, Launch } from '../game/types';
import { formatTime, launchTitle } from './labels';

interface Props {
  launch: Launch;
  setup: RaceSetup;
  track: Track;
  onFinish: (result: RaceResult) => void;
  onQuit: () => void;
}

interface RevealState {
  fact: Fact;
  given: number;
  choices: number[];
  swapped: boolean;
}

interface Line {
  speaker: Character;
  text: string;
  mood: Mood;
  id: number;
}

const RIVAL_MOOD: Partial<Record<LineKey, Mood>> = {
  playerAhead: 'angry',
  playerWins: 'shocked',
  rivalWins: 'happy',
  playerCrash: 'happy',
  timeout: 'happy',
};

const CREW_MOOD: Partial<Record<LineKey, Mood>> = {
  intro: 'happy',
  checkIntro: 'happy',
  streak: 'happy',
  playerWins: 'happy',
  playerMiss: 'shocked',
  lowHull: 'shocked',
  playerCrash: 'shocked',
  failed: 'shocked',
  timeout: 'shocked',
};

const TAUNT_COOLDOWN_MS = 2500;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function makeLine(speakers: Character[], key: LineKey, id: number): Line | null {
  const withLines = speakers.filter((s) => s.lines[key]?.length);
  if (!withLines.length) return null;
  const speaker = pick(withLines);
  const moods = speaker === PIT_BOSS ? CREW_MOOD : RIVAL_MOOD;
  return { speaker, text: pick(speaker.lines[key]!), mood: moods[key] ?? 'smug', id };
}

function endBanner(status: RaceStatus, setup: RaceSetup, speakers: Character[]): { text: string; good: boolean } {
  switch (status) {
    case 'finished':
      return {
        good: true,
        text:
          setup.mode === 'grandprix'
            ? 'Grand Prix Champion!'
            : setup.mode === 'graduation'
              ? 'Check Passed!'
              : setup.mode === 'rival'
                ? 'Victory!'
                : 'Laps Complete!',
      };
    case 'crashed':
      return { good: false, text: 'Crashed!' };
    case 'failed':
      return { good: false, text: 'Missed One — Check Failed' };
    case 'timeout':
      return { good: false, text: 'Out of Time!' };
    case 'beaten':
      return { good: false, text: `${speakers[0].name} takes the flag!` };
    case 'running':
      return { good: true, text: '' };
  }
}

export function RaceScreen({ launch, setup, track, onFinish, onQuit }: Props) {
  const [race, setRace] = useState(() => createRace(setup));
  const [phase, setPhase] = useState<'countdown' | 'racing' | 'done'>('countdown');
  const [count, setCount] = useState(3);
  const [showGo, setShowGo] = useState(false);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const startRef = useRef(0);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const hasRivals = setup.rivals.length > 0;
  const speakers = useMemo(
    () => (hasRivals ? setup.rivals.map((r) => rivalById(r.rivalId)) : [PIT_BOSS]),
    [setup, hasRivals],
  );
  const lineCounter = useRef(1);
  const lastLineAt = useRef(0);
  const [line, setLine] = useState<Line>(
    () =>
      makeLine(speakers, setup.mode === 'graduation' ? 'checkIntro' : 'intro', 0) ?? {
        speaker: speakers[0],
        text: '...',
        mood: 'smug',
        id: 0,
      },
  );

  const say = useCallback(
    (key: LineKey, force = false) => {
      const now = performance.now();
      if (!force && now - lastLineAt.current < TAUNT_COOLDOWN_MS) return;
      const next = makeLine(speakers, key, lineCounter.current++);
      if (!next) return;
      lastLineAt.current = now;
      setLine(next);
    },
    [speakers],
  );

  // Countdown: 3, 2, 1, GO
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) {
      sfx.go();
      startEngine();
      setEngineIntensity(0.3);
      startRef.current = performance.now();
      lastLineAt.current = performance.now();
      setShowGo(true);
      setPhase('racing');
      return;
    }
    sfx.beep();
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    if (!showGo) return;
    const t = setTimeout(() => setShowGo(false), 700);
    return () => clearTimeout(t);
  }, [showGo]);

  // Race clock
  useEffect(() => {
    if (phase !== 'racing') return;
    let frame = 0;
    const loop = () => {
      setRace((r) => tick(r, performance.now() - startRef.current));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => () => stopEngine(), []);

  // Race end
  useEffect(() => {
    if (race.status === 'running') return;
    setPhase('done');
    stopEngine();
    switch (race.status) {
      case 'finished':
        sfx.win();
        say('playerWins', true);
        break;
      case 'crashed':
        sfx.crash();
        say('playerCrash', true);
        break;
      case 'beaten':
        sfx.lose();
        say('rivalWins', true);
        break;
      case 'failed':
        sfx.lose();
        say(hasRivals ? 'rivalWins' : 'failed', true);
        break;
      case 'timeout':
        sfx.lose();
        say('timeout', true);
        break;
    }
    const result: RaceResult = {
      status: race.status,
      won: isWin(race.status),
      elapsedMs: race.elapsedMs,
      correct: race.correct,
      wrong: race.wrong,
      misses: missedFacts(race),
    };
    const t = setTimeout(() => finishRef.current(result), 2600);
    return () => clearTimeout(t);
    // Keyed on status alone: this must fire once, when the race leaves 'running'.
  }, [race.status]);

  // Position changes and final-stretch taunts
  const leaderRef = useRef<'player' | 'rival'>('rival');
  const finalStretchRef = useRef(false);
  const playerFrac = playerFraction(race);
  const bestRivalFrac = hasRivals ? Math.max(...setup.rivals.map((r) => rivalFraction(r, race.elapsedMs))) : 0;
  useEffect(() => {
    if (phase !== 'racing' || !hasRivals) return;
    const leader =
      playerFrac > bestRivalFrac + 0.01 ? 'player' : playerFrac < bestRivalFrac - 0.01 ? 'rival' : leaderRef.current;
    if (leader !== leaderRef.current) {
      say(leader === 'player' ? 'playerAhead' : 'rivalAhead');
      leaderRef.current = leader;
    }
    if (!finalStretchRef.current && bestRivalFrac > 0.8) {
      finalStretchRef.current = true;
      say('finalStretch', true);
    }
  }, [phase, hasRivals, playerFrac, bestRivalFrac, say]);

  // Hold a wrong answer's correction on screen briefly
  useEffect(() => {
    if (!reveal) return;
    const ms =
      setup.mode === 'grandprix'
        ? REVEAL_MS.grandprix
        : setup.inputMode === 'numberline'
          ? REVEAL_MS.numberline
          : REVEAL_MS.standard;
    const t = setTimeout(() => setReveal(null), ms);
    return () => clearTimeout(t);
  }, [reveal, setup.mode, setup.inputMode]);

  const questionKey = race.history.length;
  const choices = useMemo(
    () => choicesFor(race.current, setup.inputMode === 'choices-multiples' ? 'multiples' : 'mixed'),
    [race.current, questionKey, setup.inputMode],
  );
  const swapped = useMemo(
    () => (setup.inputMode === 'choices-mixed' || setup.inputMode === 'keypad') && Math.random() < 0.5,
    [race.current, questionKey, setup.inputMode],
  );

  const locked = phase !== 'racing' || reveal !== null || race.status !== 'running';

  const handleAnswer = useCallback(
    (value: number) => {
      if (locked) return;
      const fact = race.current;
      if (value === fact.answer) {
        sfx.correct();
        const streak = race.streak + 1;
        setEngineIntensity(Math.min(1, 0.3 + streak / 8));
        if (!hasRivals && streak % 5 === 0) say('streak');
      } else {
        sfx.wrong();
        setEngineIntensity(0.1);
        setReveal({ fact, given: value, choices, swapped });
        const hullAfter = damage(race.hull);
        if (!hasRivals && hullAfter > 0 && hullAfter <= HULL.wrongDamage) say('lowHull', true);
        else say('playerMiss', true);
      }
      const now = performance.now() - startRef.current;
      setRace((r) => answerQuestion(tick(r, now), value));
    },
    [locked, race, hasRivals, say, choices, swapped],
  );

  const shownFact = reveal?.fact ?? race.current;
  const shownChoices = reveal?.choices ?? choices;
  const shownSwapped = reveal?.swapped ?? swapped;
  const inputReveal = reveal ? { correct: reveal.fact.answer, given: reveal.given } : null;

  const { title, subtitle } = launchTitle(launch);

  const racers: MapRacer[] = [
    ...setup.rivals.map((r) => {
      const rival = rivalById(r.rivalId);
      return {
        id: rival.id,
        label: rival.name.split(' ').pop() ?? rival.name,
        progress: rivalFraction(r, race.elapsedMs),
        design: rival.pod,
      };
    }),
    { id: 'you', label: 'YOU', progress: playerFrac, design: PLAYER_POD, isPlayer: true },
  ];
  const standings = [...racers].sort((a, b) => b.progress - a.progress);

  const lap = Math.min(setup.laps, Math.floor(playerFrac * setup.laps) + 1);
  const timeLeft = setup.timeLimitMs !== null ? setup.timeLimitMs - race.elapsedMs : null;

  let overlay: ReactNode = null;
  if (phase === 'countdown') overlay = <div className="countdown" key={count}>{count || 'GO!'}</div>;
  else if (showGo) overlay = <div className="countdown go">GO!</div>;
  else if (phase === 'done') {
    const banner = endBanner(race.status, setup, speakers);
    overlay = <div className={`end-banner ${banner.good ? 'good' : 'bad'}`}>{banner.text}</div>;
  }

  return (
    <div className={`race-screen mode-${setup.mode}`}>
      <header className="race-top">
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            stopEngine();
            onQuit();
          }}
        >
          ◂ Hangar
        </button>
        <div className="race-title">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="race-stats">
          <div className="stat">
            <span className="hud-label">Lap</span>
            <span className="stat-value">
              {lap}/{setup.laps}
            </span>
          </div>
          <div className={`stat ${timeLeft !== null && timeLeft < 10_000 ? 'warn' : ''}`}>
            <span className="hud-label">{timeLeft !== null ? 'Time left' : 'Time'}</span>
            <span className="stat-value">{formatTime(timeLeft ?? race.elapsedMs)}</span>
          </div>
          <div className="stat">
            <span className="hud-label">{setup.mode === 'grandprix' ? 'Correct' : 'Course'}</span>
            <span className="stat-value">
              {setup.mode === 'grandprix' ? race.correct : race.progress}/{setup.targetSegments}
            </span>
          </div>
        </div>
      </header>

      <div className="race-main">
        <CourseMap track={track} racers={racers} laps={setup.laps} overlay={overlay} />
        <aside className="race-side">
          <TauntPanel speaker={line.speaker} text={line.text} mood={line.mood} lineId={line.id} />
          <HullGauge hull={race.hull} />
          <ol className="standings" aria-label="Standings">
            {standings.map((r, i) => (
              <li key={r.id} className={r.isPlayer ? 'player' : ''}>
                <span className="place">{i + 1}</span>
                <span className="who">{r.label}</span>
                <span className="bar">
                  <span style={{ width: `${Math.round(r.progress * 100)}%` }} />
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <section className="question-deck">
        <div className={`question ${reveal ? 'is-wrong' : ''}`} key={questionKey}>
          <span className="q-fact">{formatFact(shownFact, shownSwapped)}</span>
          <span className="q-eq">=</span>
          <span className="q-answer">{reveal ? reveal.fact.answer : '?'}</span>
        </div>
        <div className="answer-area">
          {setup.inputMode === 'numberline' ? (
            <NumberLine family={shownFact.family} onPick={handleAnswer} disabled={locked} reveal={inputReveal} />
          ) : setup.inputMode === 'choices-multiples' || setup.inputMode === 'choices-mixed' ? (
            <ChoicePad choices={shownChoices} onPick={handleAnswer} disabled={locked} reveal={inputReveal} />
          ) : (
            <Keypad onSubmit={handleAnswer} disabled={locked} reveal={inputReveal} resetKey={questionKey} />
          )}
        </div>
      </section>
    </div>
  );
}
