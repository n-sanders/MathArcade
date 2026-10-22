import { describe, expect, it } from 'vitest';
import {
  arcadeSession,
  fromArcadeStats,
  hasProgress,
  loadArcadeSave,
  pushArcadeSave,
  toArcadeProgress,
  type ArcadeSession,
} from './arcade';
import { defaultSave, getFamily } from './progress';

function storage(values: Record<string, string>) {
  return { getItem: (k: string) => values[k] ?? null };
}

interface Call {
  path: string;
  method: string;
  body: unknown;
}

function fakeFetch(responses: Record<string, unknown>) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(responses).find((k) => `${method} ${path}`.startsWith(k));
    return new Response(JSON.stringify(key ? responses[key] : {}), { status: 200 });
  }) as typeof fetch;
  return { fn, calls };
}

let tokenCounter = 0;
function session(): ArcadeSession {
  return { deviceToken: `token-${++tokenCounter}`, name: 'Rey' };
}

describe('arcadeSession', () => {
  it('needs both the arcade device token and a player name', () => {
    expect(arcadeSession(storage({}))).toBeNull();
    expect(arcadeSession(storage({ matharcade_device_token: 'abc' }))).toBeNull();
    expect(
      arcadeSession(storage({ matharcade_device_token: 'abc', matharcade_player_name: 'Rey' })),
    ).toEqual({ deviceToken: 'abc', name: 'Rey' });
  });
});

describe('toArcadeProgress', () => {
  it('reports every family rank and the weakest rank as the level', () => {
    const save = defaultSave();
    for (const f of Object.keys(save.families)) save.families[f] = { ...save.families[f], rank: 'S' };
    save.families[12] = { ...getFamily(save, 12), rank: 'B' };
    const out = toArcadeProgress(save);
    expect(Object.keys(out.stats.ranks)).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    expect(out.stats.ranks['2']).toBe('S');
    expect(out.stats.ranks['12']).toBe('B');
    expect(out.difficultyLevel).toBe(2);
    expect('settings' in out.stats.save).toBe(false);
  });

  it('round-trips through statsJson', () => {
    const save = defaultSave();
    save.families[7] = { ...getFamily(save, 7), rank: 'A', raceWins: 2, bestRaceMs: 41_000 };
    save.grandPrix.bestCorrect = 33;
    const loaded = fromArcadeStats(JSON.stringify(toArcadeProgress(save).stats));
    expect(loaded).toEqual(save);
  });

  it('ignores stats that hold no Pod Racer save', () => {
    expect(fromArcadeStats('{}')).toBeNull();
    expect(fromArcadeStats('{bad json')).toBeNull();
    expect(fromArcadeStats(undefined)).toBeNull();
  });
});

describe('hasProgress', () => {
  it('is false for an untouched save even if sound is muted', () => {
    const save = defaultSave();
    save.settings.muted = true;
    expect(hasProgress(save)).toBe(false);
    save.families[3] = { ...getFamily(save, 3), practiceRounds: 1 };
    expect(hasProgress(save)).toBe(true);
  });
});

describe('server sync', () => {
  it('registers the player once, then reads and writes /api/progress/podracer', async () => {
    const s = session();
    const save = defaultSave();
    save.families[4] = { ...getFamily(save, 4), rank: 'B' };
    const { fn, calls } = fakeFetch({
      'GET /api/progress/podracer': { exists: true, statsJson: JSON.stringify(toArcadeProgress(save).stats) },
    });

    const remote = await loadArcadeSave(s, fn);
    expect(remote.exists).toBe(true);
    expect(getFamily(remote.save!, 4).rank).toBe('B');

    await pushArcadeSave(s, save, fn);
    expect(calls.map((c) => `${c.method} ${c.path.split('?')[0]}`)).toEqual([
      'POST /api/players',
      'GET /api/progress/podracer',
      'PUT /api/progress/podracer',
    ]);
    expect(calls[2].body).toMatchObject({ deviceToken: s.deviceToken, difficultyLevel: 1 });
  });

  it('reports a missing server row so local progress can be uploaded', async () => {
    const { fn } = fakeFetch({ 'GET /api/progress/podracer': { exists: false, statsJson: '{}' } });
    expect(await loadArcadeSave(session(), fn)).toEqual({ exists: false, save: null });
  });
});
