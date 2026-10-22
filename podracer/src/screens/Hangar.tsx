import { PodRacer } from '../components/PodRacer';
import { Portrait } from '../components/Portrait';
import { PLAYER_POD, rivalForFamily } from '../game/characters';
import { FAMILIES, GRAND_PRIX, RACE_WINS_TO_RANK_UP } from '../game/config';
import { familiesAtLeast, getFamily, isGrandPrixUnlocked, nextActivity, type SaveData } from '../game/progress';
import type { FamilyActivity } from '../game/types';
import { activityHint, activityLabel, formatTime } from './labels';

interface Props {
  save: SaveData;
  onLaunch: (family: number, activity: FamilyActivity) => void;
  onGrandPrix: () => void;
  onReset: () => void;
}

export function Hangar({ save, onLaunch, onGrandPrix, onReset }: Props) {
  const atA = familiesAtLeast(save, 'A').length;
  const gpUnlocked = isGrandPrixUnlocked(save);

  return (
    <div className="hangar">
      <section className="hero">
        <div className="hero-text">
          <h1>
            Multiplication <span>Pod Racer</span>
          </h1>
          <p>
            Every fact family has a rival. Practice your laps, pass the graduation check, then race your way from
            Rank C to Rank S.
          </p>
        </div>
        <div className="hero-pod">
          <PodRacer design={PLAYER_POD} className="hero-pod-svg" title="Your pod racer" />
          <span className="hero-pod-caption">Your pod · customization coming soon</span>
        </div>
      </section>

      <section className={`grand-prix-card ${gpUnlocked ? 'unlocked' : 'locked'}`}>
        <div>
          <h2>Twin Suns Grand Prix</h2>
          <p>
            Pick {GRAND_PRIX.minFamilies}+ fact families · {GRAND_PRIX.durationMs / 1000} seconds ·{' '}
            {GRAND_PRIX.targetCorrect} correct answers to win
            {save.grandPrix.attempts > 0 &&
              ` · Wins ${save.grandPrix.wins} · Best ${save.grandPrix.bestCorrect} correct`}
          </p>
        </div>
        {gpUnlocked ? (
          <button type="button" className="btn primary" onClick={onGrandPrix}>
            Enter Grand Prix
          </button>
        ) : (
          <div className="gp-lock">
            <span className="lock-icon" aria-hidden>
              ⛭
            </span>
            Reach Rank A in {GRAND_PRIX.familiesAtRankAToUnlock} families ({atA}/{GRAND_PRIX.familiesAtRankAToUnlock})
          </div>
        )}
      </section>

      <section className="family-grid" aria-label="Fact families">
        {FAMILIES.map((family) => {
          const fp = getFamily(save, family);
          const rival = rivalForFamily(family);
          const activity = nextActivity(fp);
          const revealed = fp.rank !== 'C';
          const needed = RACE_WINS_TO_RANK_UP[fp.rank];
          let status = activityHint(activity, fp.practiceRounds);
          if (activity === 'rival') {
            status =
              needed !== null
                ? `Wins ${fp.raceWins}/${needed} to Rank ${fp.rank === 'B' ? 'A' : 'S'}`
                : 'Champion! Defend your title.';
          }

          return (
            <article key={family} className={`family-card rank-${fp.rank}`}>
              <header>
                <span className="family-num">×{family}</span>
                <span className={`rank-badge rank-${fp.rank}`} title={`Rank ${fp.rank}`}>
                  {fp.rank}
                </span>
              </header>
              <div className="family-rival">
                <Portrait
                  className="family-portrait"
                  design={rival.portrait}
                  silhouette={!revealed}
                  title={revealed ? rival.name : 'Unknown rival'}
                />
                <div>
                  <div className="rival-name">{revealed ? rival.name : 'Unknown Rival'}</div>
                  <div className="rival-title">{revealed ? rival.title : 'Appears at Rank B'}</div>
                </div>
              </div>
              {revealed && <PodRacer design={rival.pod} className="family-pod" title={`${rival.name}'s pod`} animated={false} />}
              <div className="family-status">
                {status}
                {fp.bestRaceMs !== null && <span className="best"> · Best {formatTime(fp.bestRaceMs)}</span>}
              </div>
              <div className="family-actions">
                <button type="button" className="btn primary" onClick={() => onLaunch(family, activity)}>
                  {activityLabel(activity, family)}
                </button>
                {activity !== 'practice' && (
                  <button type="button" className="btn ghost" onClick={() => onLaunch(family, 'practice')}>
                    Practice
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <footer className="hangar-footer">
        <span>Progress is saved on this device.</span>
        <button
          type="button"
          className="btn link"
          onClick={() => {
            if (window.confirm('Erase all progress on this device?')) onReset();
          }}
        >
          Reset progress
        </button>
      </footer>
    </div>
  );
}
