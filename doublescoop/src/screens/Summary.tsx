import { useEffect } from 'react';
import { sfx } from '../audio/sound';
import { canTakeTest, type ProgressEvent, type SaveData } from '../game/progress';
import { formatProblem } from '../game/problems';
import type { RoundResult } from '../game/round';
import type { RoundMode } from '../game/types';
import { formatPercent, formatSeconds } from './labels';

interface Props {
  result: RoundResult;
  events: ProgressEvent[];
  save: SaveData;
  testRun: boolean;
  onPlay: (mode: RoundMode) => void;
  onParlor: () => void;
}

function eventLine(e: ProgressEvent): { text: string; tone: 'good' | 'bad' | 'rank-up' | '' } {
  switch (e.type) {
    case 'roundLogged':
      return { text: `Round ${e.count}/${e.needed} logged at this rank.`, tone: '' };
    case 'testUnlocked':
      return { text: `Rank-up test unlocked! Score 100% to reach the next rank.`, tone: 'good' };
    case 'rankUp':
      return { text: `Rank up! ${e.from} → ${e.to}`, tone: 'rank-up' };
    case 'testFailed':
      return { text: `Test missed. No rank lost; try the test again whenever you're ready.`, tone: 'bad' };
    case 'newBest':
      return { text: `New best score: ${e.score}!`, tone: 'good' };
  }
}

function headline(result: RoundResult): { title: string; sub: string; good: boolean } {
  if (result.mode === 'test') {
    return result.passed
      ? { title: 'Perfect Test!', sub: `Every scoop landed in Rank ${result.rank}.`, good: true }
      : { title: 'Test Missed', sub: `Got ${result.correct} right before the first slip.`, good: false };
  }
  if (result.accuracy === 1) return { title: 'Flawless Round!', sub: 'Not a single drip.', good: true };
  if (result.accuracy >= 0.85) return { title: 'Sweet Round!', sub: 'Nice and steady.', good: true };
  return { title: 'Round Complete', sub: 'Slow and careful keeps the cone standing.', good: true };
}

export function Summary({ result, events, save, testRun, onPlay, onParlor }: Props) {
  const head = headline(result);
  const rankedUp = events.some((e) => e.type === 'rankUp');

  useEffect(() => {
    if (rankedUp) sfx.coneDone();
  }, [rankedUp]);

  const showTest = !testRun && canTakeTest(save);

  return (
    <div className="summary">
      <header className={`summary-head ${head.good ? '' : 'bad'}`}>
        <h2>{head.title}</h2>
        <p>{head.sub}</p>
      </header>

      <section className="summary-stats">
        <div className="card">
          <span className="hud-label">Accuracy</span>
          <span className="stat-value">{formatPercent(result.accuracy)}</span>
          <span className="hud-label">
            {result.correct}/{result.answered}
          </span>
        </div>
        <div className="card">
          <span className="hud-label">Avg time</span>
          <span className="stat-value">{formatSeconds(result.avgMs)}</span>
        </div>
        <div className="card">
          <span className="hud-label">Best streak</span>
          <span className="stat-value">{result.bestStreak}</span>
        </div>
        <div className="card">
          <span className="hud-label">Cones</span>
          <span className="stat-value">{result.conesCompleted}</span>
        </div>
        <div className="card">
          <span className="hud-label">Score</span>
          <span className="stat-value">{result.score}</span>
        </div>
      </section>

      {testRun && (
        <ul className="events">
          <li>Test rank is on, so this result was not saved.</li>
        </ul>
      )}

      {events.length > 0 && (
        <ul className="events">
          {events.map((e, i) => {
            const line = eventLine(e);
            return (
              <li key={i} className={line.tone}>
                {line.text}
              </li>
            );
          })}
        </ul>
      )}

      {result.misses.length > 0 && (
        <section className="card">
          <span className="hud-label">Practice these</span>
          <div className="misses">
            {result.misses.map((m, i) => (
              <span key={i} className="miss-chip">
                {formatProblem(m.problem)} = {m.problem.answer}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="summary-actions">
        {showTest && (
          <button type="button" className="btn mint big" onClick={() => onPlay('test')}>
            {result.mode === 'test' && !result.passed ? 'Retry test' : 'Take rank-up test'}
          </button>
        )}
        <button type="button" className={`btn big ${showTest ? '' : 'primary'}`} onClick={() => onPlay('round')}>
          {rankedUp ? `Play Rank ${save.rank}` : 'Play another round'}
        </button>
        <button type="button" className="btn ghost big" onClick={onParlor}>
          Back to parlor
        </button>
      </div>
    </div>
  );
}
