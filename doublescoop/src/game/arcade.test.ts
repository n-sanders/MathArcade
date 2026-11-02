import { describe, expect, it } from 'vitest';
import {
  arcadeSession,
  fromArcadeStats,
  loadArcadeSave,
  pushArcadeSave,
  submitArcadeScore,
  toArcadeProgress,
  type ArcadeSession,
} from './arcade';
import { defaultSave } from './progress';

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
  return { deviceToken: `token-${++tokenCounter}`, name: 'Pip' };
}

describe('arcadeSession', () => {
  it('needs both the arcade device token and a player name', () => {
    expect(arcadeSession(storage({}))).toBeNull();
    expect(arcadeSession(storage({ matharcade_device_token: 'abc' }))).toBeNull();
    expect(arcadeSession(storage({ matharcade_device_token: 'abc', matharcade_player_name: 'Pip' }))).toEqual({
      deviceToken: 'abc',
      name: 'Pip',
    });
  });
});

describe('toArcadeProgress', () => {
  it('reports the rank as stats.rank and difficultyLevel 1-4', () => {
    const out = toArcadeProgress({ ...defaultSave(), rank: 'A' });
    expect(out.stats.rank).toBe('A');
    expect(out.difficultyLevel).toBe(3);
    expect('settings' in out.stats.save).toBe(false);
  });

  it('round-trips through statsJson', () => {
    const save = { ...defaultSave(), rank: 'B' as const, roundsAtRank: 1, bestScore: 820 };
    expect(fromArcadeStats(JSON.stringify(toArcadeProgress(save).stats))).toEqual(save);
  });

  it('ignores stats that hold no Double Scoop save', () => {
    expect(fromArcadeStats('{}')).toBeNull();
    expect(fromArcadeStats('{bad json')).toBeNull();
    expect(fromArcadeStats(undefined)).toBeNull();
  });
});

describe('server sync', () => {
  it('registers once, then reads and writes /api/progress/doublescoop and posts scores', async () => {
    const s = session();
    const save = { ...defaultSave(), rank: 'S' as const };
    const { fn, calls } = fakeFetch({
      'GET /api/progress/doublescoop': { exists: true, statsJson: JSON.stringify(toArcadeProgress(save).stats) },
    });

    const remote = await loadArcadeSave(s, fn);
    expect(remote.save?.rank).toBe('S');
    await pushArcadeSave(s, save, fn);
    await submitArcadeScore(s, 912.7, fn);
    expect(calls.map((c) => `${c.method} ${c.path.split('?')[0]}`)).toEqual([
      'POST /api/players',
      'GET /api/progress/doublescoop',
      'PUT /api/progress/doublescoop',
      'POST /api/scores',
    ]);
    expect(calls[2].body).toMatchObject({ deviceToken: s.deviceToken, difficultyLevel: 4 });
    expect(calls[3].body).toMatchObject({ gameId: 'doublescoop', score: 912 });
  });

  it('reports a missing server row so local progress can be uploaded', async () => {
    const { fn } = fakeFetch({ 'GET /api/progress/doublescoop': { exists: false, statsJson: '{}' } });
    expect(await loadArcadeSave(session(), fn)).toEqual({ exists: false, save: null });
  });
});
