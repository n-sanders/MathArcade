import { Portrait } from '../components/Portrait';
import { PIT_BOSS, rivalForFamily } from '../game/characters';
import { formatFact } from '../game/facts';
import { getFamily, nextActivity, type ProgressEvent, type RaceResult, type SaveData } from '../game/progress';
import type { FamilyActivity, Launch } from '../game/types';
import { activityLabel, formatTime, launchTitle } from './labels';

interface Props {
  launch: Launch;
  result: RaceResult;
  events: ProgressEvent[];
  save: SaveData;
  onRetry: () => void;
  onNext: (activity: FamilyActivity) => void;
  onHangar: () => void;
}

function describe(event: ProgressEvent): string {
  switch (event.type) {
    case 'practiceLogged':
      return `Practice round logged: ${event.count}/${event.needed}.`;
    case 'graduationUnlocked':
      return `×${event.family} graduation check unlocked!`;
    case 'reviewRequired':
      return 'Do one review round, then try the check again.';
    case 'reviewCleared':
      return 'Review done — the graduation check is open again.';
    case 'rankUp':
      return event.to === 'B'
        ? `RANK UP! ×${event.family} is now Rank B. ${rivalForFamily(event.family).name} has noticed you...`
        : `RANK UP! ×${event.family} is now Rank ${event.to}.`;
    case 'raceWin':
      return event.needed !== null ? `Race wins at this rank: ${event.wins}/${event.needed}.` : 'Title defended!';
    case 'newBest':
      return `New best time: ${formatTime(event.ms)}!`;
    case 'grandPrixUnlocked':
      return 'The Twin Suns Grand Prix is now unlocked!';
    case 'grandPrixWin':
      return `Grand Prix won with ${event.correct} correct answers!`;
  }
}

function headline(result: RaceResult, launch: Launch): string {
  if (result.won) {
    if (launch.kind === 'grandprix') return 'Grand Prix Champion!';
    switch (launch.activity) {
      case 'graduation':
        return 'Graduation Check Passed!';
      case 'rival':
        return 'You Won the Race!';
      default:
        return 'Round Complete!';
    }
  }
  switch (result.status) {
    case 'crashed':
      return 'Your Pod Crashed';
    case 'failed':
      return 'Check Not Passed — Yet';
    case 'timeout':
      return 'Out of Time';
    case 'beaten':
      return 'Your Rival Got There First';
    default:
      return 'Race Over';
  }
}

export function Results({ launch, result, events, save, onRetry, onNext, onHangar }: Props) {
  const { title } = launchTitle(launch);
  const speaker =
    launch.kind === 'family' && launch.activity === 'rival' ? rivalForFamily(launch.family) : PIT_BOSS;
  const mood = result.won ? (speaker === PIT_BOSS ? 'happy' : 'shocked') : speaker === PIT_BOSS ? 'shocked' : 'happy';
  const rankUp = events.some((e) => e.type === 'rankUp' || e.type === 'grandPrixWin');

  let next: FamilyActivity | null = null;
  let canRetry = true;
  if (launch.kind === 'family') {
    const upcoming = nextActivity(getFamily(save, launch.family));
    if (upcoming !== launch.activity) next = upcoming;
    // Graduation and review are one-shot gates; once passed they're no longer the right thing to repeat.
    canRetry = launch.activity === 'practice' || launch.activity === 'rival' || upcoming === launch.activity;
  }

  return (
    <div className={`results ${result.won ? 'won' : 'lost'} ${rankUp ? 'celebrate' : ''}`}>
      <div className="results-card">
        <Portrait className="results-portrait" design={speaker.portrait} mood={mood} />
        <div className="results-body">
          <div className="hud-label">{title}</div>
          <h2>{headline(result, launch)}</h2>
          <dl className="results-stats">
            <div>
              <dt>Correct</dt>
              <dd>{result.correct}</dd>
            </div>
            <div>
              <dt>Missed</dt>
              <dd>{result.wrong}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatTime(result.elapsedMs)}</dd>
            </div>
          </dl>
          {events.length > 0 && (
            <ul className="results-events">
              {events.map((e, i) => (
                <li key={i} className={e.type === 'rankUp' || e.type === 'grandPrixUnlocked' ? 'big' : ''}>
                  {describe(e)}
                </li>
              ))}
            </ul>
          )}
          {result.misses.length > 0 && (
            <div className="results-misses">
              <div className="hud-label">Facts to polish</div>
              <div className="miss-list">
                {result.misses.map((f) => (
                  <span key={`${f.family}x${f.multiplier}`} className="miss">
                    {formatFact(f)} = {f.answer}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="results-actions">
            {next && launch.kind === 'family' && (
              <button type="button" className="btn primary" onClick={() => onNext(next)}>
                Next: {activityLabel(next, launch.family)}
              </button>
            )}
            {canRetry && (
              <button type="button" className={next ? 'btn ghost' : 'btn primary'} onClick={onRetry}>
                Race Again
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onHangar}>
              Back to Hangar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
