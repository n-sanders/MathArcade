import { RANK_RULES, ROUNDS_TO_TEST } from '../game/config';
import { canTakeTest, isTopRank, type SaveData } from '../game/progress';
import { RANK_ORDER, type Rank, type RoundMode } from '../game/types';
import { formatPercent, RANK_BLURBS } from './labels';

interface Props {
  save: SaveData;
  /** Rank actually played (differs from save.rank when the test-rank override is on). */
  playRank: Rank;
  onPlay: (mode: RoundMode) => void;
  onReset: () => void;
}

export function Parlor({ save, playRank, onPlay, onReset }: Props) {
  const testReady = canTakeTest(save) && playRank === save.rank;
  const top = isTopRank(save.rank);
  const accuracy = save.stats.totalAnswered ? save.stats.totalCorrect / save.stats.totalAnswered : null;
  const rules = RANK_RULES[playRank];

  return (
    <div className="parlor">
      <section className="parlor-hero">
        <div>
          <h1>Double Scoop</h1>
          <p>
            Solve doubles to stack scoops on your cone. Get <strong>5 in a row</strong> to finish a cone, but one wrong
            answer and the whole thing topples over! Bigger streaks score more points.
          </p>
        </div>

        <div className="card rank-card">
          <span className="hud-label">Your rank</span>
          <span className={`rank-badge lg rank-${playRank}`}>{playRank}</span>
          <p className="rank-blurb">{RANK_BLURBS[playRank]}</p>
          <span className="hud-label">
            {rules.questions} questions{rules.timeLimitMs ? ` · ${rules.timeLimitMs / 1000}s each` : ''}
          </span>

          {!top && (
            <>
              <div className="round-pips" aria-label={`${save.roundsAtRank} of ${ROUNDS_TO_TEST} rounds done`}>
                {Array.from({ length: ROUNDS_TO_TEST }, (_, i) => (
                  <span key={i} className={`pip ${i < save.roundsAtRank ? 'on' : ''}`} />
                ))}
                <span className="hud-label">rounds</span>
              </div>
            </>
          )}

          <div className="play-actions">
            <button type="button" className="btn primary big" onClick={() => onPlay('round')}>
              Play round
            </button>
            {!top && (
              <button type="button" className="btn mint big" disabled={!testReady} onClick={() => onPlay('test')}>
                Rank-up test
              </button>
            )}
          </div>
          {!top && !testReady && (
            <p className="lock-note">
              {playRank !== save.rank
                ? 'Test rank is on, so progress is not saved.'
                : `Finish ${ROUNDS_TO_TEST - save.roundsAtRank} more round${
                    ROUNDS_TO_TEST - save.roundsAtRank === 1 ? '' : 's'
                  } to unlock the rank-up test.`}
            </p>
          )}
          {testReady && <p className="lock-note">Perfect score on the test moves you up a rank. No penalty for missing!</p>}
          {top && <p className="lock-note">Top rank! Chase a new high score.</p>}
        </div>
      </section>

      <section className="ladder" aria-label="Ranks">
        {RANK_ORDER.map((rank) => {
          const idx = RANK_ORDER.indexOf(rank);
          const reached = idx <= RANK_ORDER.indexOf(save.rank);
          return (
            <div key={rank} className={`card ladder-step ${reached ? 'reached' : ''} ${rank === save.rank ? 'current' : ''}`}>
              <span className={`rank-badge rank-${rank}`}>{rank}</span>
              <p>{RANK_BLURBS[rank]}</p>
              <span className="meta">
                {RANK_RULES[rank].questions} questions{RANK_RULES[rank].timeLimitMs ? ' · timed' : ''}
              </span>
            </div>
          );
        })}
      </section>

      <section className="parlor-stats">
        <div className="stat">
          <span className="hud-label">Best score</span>
          <span className="stat-value">{save.bestScore}</span>
        </div>
        <div className="stat">
          <span className="hud-label">Best streak</span>
          <span className="stat-value">{save.stats.bestStreak}</span>
        </div>
        <div className="stat">
          <span className="hud-label">Rounds</span>
          <span className="stat-value">{save.stats.roundsPlayed}</span>
        </div>
        <div className="stat">
          <span className="hud-label">Accuracy</span>
          <span className="stat-value">{accuracy === null ? '-' : formatPercent(accuracy)}</span>
        </div>
        <button
          type="button"
          className="btn link"
          onClick={() => {
            if (window.confirm('Reset all Double Scoop progress?')) onReset();
          }}
        >
          Reset progress
        </button>
      </section>
    </div>
  );
}
