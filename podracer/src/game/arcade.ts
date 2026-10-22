import { FAMILIES } from './config';
import { defaultSave, getFamily, parseSave, type SaveData } from './progress';
import { RANK_ORDER, type Rank } from './types';

/**
 * Bridge to MathArcade when this build is served from the arcade's origin. The arcade keeps its player identity in localStorage, so sharing
 * the origin is what makes the bridge possible; without it the game stays local-only.
 */
export const ARCADE_GAME_ID = 'podracer';
const TOKEN_KEY = 'matharcade_device_token';
const NAME_KEY = 'matharcade_player_name';

export interface ArcadeSession {
  deviceToken: string;
  name: string;
}

export interface ArcadeProgress {
  difficultyLevel: number;
  stats: { ranks: Record<string, Rank>; save: Omit<SaveData, 'settings'> };
}

export interface RemoteSave {
  exists: boolean;
  save: SaveData | null;
}

type Fetch = typeof fetch;

function safeStorage(): Pick<Storage, 'getItem'> | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** The arcade player on this device, or null when not hosted by MathArcade (or not signed in yet). */
export function arcadeSession(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): ArcadeSession | null {
  const deviceToken = storage?.getItem(TOKEN_KEY)?.trim();
  const name = storage?.getItem(NAME_KEY)?.trim();
  return deviceToken && name ? { deviceToken, name } : null;
}

/**
 * MathArcade's per-number rank shape: `stats.ranks` keyed by family. `difficultyLevel` is the
 * weakest family's rank (1-4) since the arcade only has one level column per game.
 */
export function toArcadeProgress(save: SaveData): ArcadeProgress {
  const ranks: Record<string, Rank> = {};
  let lowest = RANK_ORDER.length - 1;
  for (const f of FAMILIES) {
    const rank = getFamily(save, f).rank;
    ranks[f] = rank;
    lowest = Math.min(lowest, RANK_ORDER.indexOf(rank));
  }
  const { settings: _settings, ...rest } = save;
  return { difficultyLevel: lowest + 1, stats: { ranks, save: rest } };
}

/** Rebuilds a save from the arcade's `statsJson`, or null if it holds no Pod Racer save. */
export function fromArcadeStats(statsJson: unknown): SaveData | null {
  let stats: unknown = statsJson;
  if (typeof statsJson === 'string') {
    try {
      stats = JSON.parse(statsJson);
    } catch {
      return null;
    }
  }
  if (!stats || typeof stats !== 'object') return null;
  const save = (stats as { save?: unknown }).save;
  return save && typeof save === 'object' ? parseSave(save) : null;
}

/** True once any race has been logged, so an untouched default save is never pushed. */
export function hasProgress(save: SaveData): boolean {
  const blank = defaultSave();
  return JSON.stringify({ ...save, settings: blank.settings }) !== JSON.stringify(blank);
}

const registered = new Map<string, Promise<void>>();

function ensurePlayer(session: ArcadeSession, fetchFn: Fetch): Promise<void> {
  let pending = registered.get(session.deviceToken);
  if (!pending) {
    pending = request(fetchFn, '/api/players', 'POST', { name: session.name, deviceToken: session.deviceToken })
      .then(() => undefined)
      .catch((err) => {
        registered.delete(session.deviceToken);
        throw err;
      });
    registered.set(session.deviceToken, pending);
  }
  return pending;
}

async function request(fetchFn: Fetch, path: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetchFn(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`MathArcade ${method} ${path} failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

export async function loadArcadeSave(session: ArcadeSession, fetchFn: Fetch = fetch): Promise<RemoteSave> {
  await ensurePlayer(session, fetchFn);
  const token = encodeURIComponent(session.deviceToken);
  const row = (await request(fetchFn, `/api/progress/${ARCADE_GAME_ID}?deviceToken=${token}`, 'GET')) as {
    exists?: boolean;
    statsJson?: unknown;
  } | null;
  if (!row || row.exists === false) return { exists: false, save: null };
  return { exists: true, save: fromArcadeStats(row.statsJson) };
}

export async function pushArcadeSave(session: ArcadeSession, save: SaveData, fetchFn: Fetch = fetch): Promise<void> {
  await ensurePlayer(session, fetchFn);
  const { difficultyLevel, stats } = toArcadeProgress(save);
  await request(fetchFn, `/api/progress/${ARCADE_GAME_ID}`, 'PUT', {
    deviceToken: session.deviceToken,
    difficultyLevel,
    statsJson: JSON.stringify(stats),
  });
}

/** Grand Prix correct answers feed the arcade leaderboard; the server keeps each player's best. */
export async function submitArcadeScore(session: ArcadeSession, score: number, fetchFn: Fetch = fetch): Promise<void> {
  await ensurePlayer(session, fetchFn);
  await request(fetchFn, '/api/scores', 'POST', {
    deviceToken: session.deviceToken,
    gameId: ARCADE_GAME_ID,
    score: Math.max(0, Math.floor(score)),
  });
}
