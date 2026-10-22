import { useEffect, useRef, useState } from 'react';
import { setMuted, sfx } from './audio/sound';
import { arcadeSession, hasProgress, loadArcadeSave, pushArcadeSave, submitArcadeScore } from './game/arcade';
import { applyResult, defaultSave, getFamily, loadSave, writeSave, type ProgressEvent, type RaceResult, type SaveData } from './game/progress';
import type { RaceSetup } from './game/race';
import { buildFamilySetup, buildGrandPrixSetup } from './game/setups';
import { trackFor, type Track } from './game/tracks';
import { RANK_ORDER, type FamilyActivity, type Launch, type Rank } from './game/types';
import { GrandPrixSetup } from './screens/GrandPrixSetup';
import { Hangar } from './screens/Hangar';
import { RaceScreen } from './screens/RaceScreen';
import { Results } from './screens/Results';

type View =
  | { name: 'hangar' }
  | { name: 'gp-setup' }
  | { name: 'race'; launch: Launch; setup: RaceSetup; track: Track; runId: number; testRun: boolean }
  | { name: 'results'; launch: Launch; result: RaceResult; events: ProgressEvent[] };

const TEST_TOOLS_ENABLED = import.meta.env.DEV || new URLSearchParams(window.location.search).has('test');

const ARCADE = arcadeSession();

function logSyncError(err: unknown) {
  console.warn('Pod Racer: MathArcade sync failed', err);
}

function launchRank(launch: Launch, save: SaveData, rankOverride: Rank | null): Rank {
  return launch.kind === 'grandprix' ? 'S' : rankOverride ?? getFamily(save, launch.family).rank;
}

function buildSetup(launch: Launch, rank: Rank): RaceSetup {
  return launch.kind === 'grandprix'
    ? buildGrandPrixSetup(launch.families)
    : buildFamilySetup(launch.activity, launch.family, rank);
}

export function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [view, setView] = useState<View>({ name: 'hangar' });
  const [rankOverride, setRankOverride] = useState<Rank | null>(null);

  const committedSinceMount = useRef(false);

  useEffect(() => setMuted(save.settings.muted), [save.settings.muted]);

  useEffect(() => {
    if (!ARCADE) return;
    let cancelled = false;
    const local = save;
    loadArcadeSave(ARCADE)
      .then((remote) => {
        if (cancelled || committedSinceMount.current) return;
        if (remote.save) {
          const next = { ...remote.save, settings: local.settings };
          setSave(next);
          writeSave(next);
        } else if (!remote.exists && hasProgress(local)) {
          return pushArcadeSave(ARCADE, local);
        }
      })
      .catch(logSyncError);
    return () => {
      cancelled = true;
    };
    // Only reconcile with the server once, against the save loaded from localStorage.
  }, []);

  /** `sync: false` keeps device-only changes (like sound) from counting as an arcade session. */
  const commit = (next: SaveData, { sync = true } = {}) => {
    setSave(next);
    writeSave(next);
    if (sync && ARCADE) {
      committedSinceMount.current = true;
      pushArcadeSave(ARCADE, next).catch(logSyncError);
    }
  };

  const launch = (l: Launch) => {
    sfx.click();
    const rank = launchRank(l, save, rankOverride);
    setView({
      name: 'race',
      launch: l,
      setup: buildSetup(l, rank),
      track: trackFor(l, rank),
      runId: Date.now(),
      testRun: rankOverride !== null,
    });
  };

  const launchFamily = (family: number, activity: FamilyActivity) => launch({ kind: 'family', family, activity });

  const toHangar = () => setView({ name: 'hangar' });

  return (
    <div className="app">
      <nav className="top-nav">
        <button type="button" className="brand" onClick={toHangar}>
          <span className="brand-mark" aria-hidden>
            ✦
          </span>
          Multiplication Pod Racer
        </button>
        <div className="nav-tools">
          {ARCADE && (
            <a className="btn ghost small" href="/">
              Back to Arcade
            </a>
          )}
          {TEST_TOOLS_ENABLED && (
            <label className={`test-rank ${rankOverride ? 'active' : ''}`}>
              {rankOverride ? `TEST RANK ${rankOverride}` : 'Test rank'}
              <select
                value={rankOverride ?? ''}
                onChange={(e) => setRankOverride((e.target.value || null) as Rank | null)}
              >
                <option value="">Off</option>
                {RANK_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="btn ghost small"
            aria-pressed={!save.settings.muted}
            onClick={() =>
              commit({ ...save, settings: { ...save.settings, muted: !save.settings.muted } }, { sync: false })
            }
          >
            {save.settings.muted ? 'Sound: off' : 'Sound: on'}
          </button>
        </div>
      </nav>

      <main>
        {view.name === 'hangar' && (
          <Hangar
            save={save}
            onLaunch={launchFamily}
            onGrandPrix={() => setView({ name: 'gp-setup' })}
            onReset={() => {
              commit({ ...defaultSave(), settings: save.settings });
              toHangar();
            }}
          />
        )}

        {view.name === 'gp-setup' && (
          <GrandPrixSetup save={save} onBack={toHangar} onStart={(families) => launch({ kind: 'grandprix', families })} />
        )}

        {view.name === 'race' && (
          <RaceScreen
            key={view.runId}
            launch={view.launch}
            setup={view.setup}
            track={view.track}
            onQuit={toHangar}
            onFinish={(result) => {
              const out = applyResult(save, view.launch, result);
              if (!view.testRun) {
                commit(out.save);
                if (ARCADE && view.launch.kind === 'grandprix' && result.correct > 0) {
                  submitArcadeScore(ARCADE, result.correct).catch(logSyncError);
                }
              }
              setView({ name: 'results', launch: view.launch, result, events: out.events });
            }}
          />
        )}

        {view.name === 'results' && (
          <Results
            launch={view.launch}
            result={view.result}
            events={view.events}
            save={save}
            onRetry={() => launch(view.launch)}
            onNext={(activity) => view.launch.kind === 'family' && launchFamily(view.launch.family, activity)}
            onHangar={toHangar}
          />
        )}
      </main>
    </div>
  );
}
