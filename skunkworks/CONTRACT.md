# Scoring, progress, catalog, radar, daily bonus

Source of truth for **integrate**. Create-games implement the **blob shape** via stubs; they do not call the API.

---

## Identity (arcade host)

- `localStorage` `matharcade_device_token` — UUID, created by `common.js`
- `localStorage` `matharcade_player_name`
- `MathArcade.ensurePlayer()` before `saveProgress` / `submitScore`, except `keepalive: true` pagehide paths (then skip if no name)
- No passwords. Admin is header `X-Admin-Key` = config `Admin:MagicWord` (not used by games)

## Two different numbers (do not conflate)

| Channel | API | Meaning |
|---|---|---|
| **Leaderboard score** | `POST /api/scores` | Non-negative integer. Server keeps **one best per player per game**. Lower scores are ignored. `gameId` is trimmed and lowercased. |
| **Progress / rank / daily bonus** | `PUT /api/progress/{gameId}` | `difficultyLevel` + `statsJson`. **Every successful save sets `UpdatedAt` (UTC).** A save today unlocks credit toward the daily bonus, **whether or not rank increased**. |

`submitScore` never writes rank. `saveProgress` never updates the high-score table.

Typical session: both. Prefer **progress before score** on hide so the bonus still unlocks if score sync fails.

### Client helpers (`wwwroot/js/common.js`)

```js
MathArcade.submitScore(gameId, score, { keepalive?: boolean })
MathArcade.saveProgress(gameId, difficultyLevel, stats, { keepalive?: boolean })
MathArcade.loadProgress(gameId)  // { gameId, difficultyLevel, statsJson, updatedAt?, exists }
```

- `stats` may be an object (stringified by `saveProgress`) or a JSON string. Server stores the string it is given.
- Server clamps `difficultyLevel` to **1–20**; math games still send **1–4**.
- Missing player → scores/progress POST/PUT 404 `"Player not found. Register first."`
- `GET` progress for unknown player or never-played game returns `exists: false`, `difficultyLevel: 1`, `statsJson: "{}"` (not an error).

Score POST body: `{ deviceToken, gameId, score }` → `{ highScore, submitted, isNewHigh }`.

Progress PUT body: `{ deviceToken, difficultyLevel, statsJson }` → `{ gameId, difficultyLevel, statsJson, updatedAt }` (no `exists`).

Keepalive fetches skip `ensurePlayer` if there is no stored name (return `null` rather than prompt).

## Rank letters (math games)

`RANKS = ["C", "B", "A", "S"]` in `common.js`.

**Never** restore rank from `difficultyLevel` alone. Old rows may have leftover numeric levels. If `stats.rank` is missing or not in `RANKS`, start at **C**.

```js
function nextRank(r) {
  const i = RANKS.indexOf(r);
  return RANKS[Math.min(RANKS.length - 1, i + 1)];
}
function rankLevel(rank) {
  return RANKS.indexOf(rank) + 1; // C=1 B=2 A=3 S=4
}
```

Promotion knobs (rounds, timers, decoys) stay in the game. S-rank fail **may** demote to A. If you demote, persist the new letter immediately.

## `rankMode` (catalog field + stats blob)

Set on the `GAMES` entry. Lobby uses it in `getGameRankSummary`.

### `"single"` (most math games)

```json
{ "rank": "C" }
```

`difficultyLevel` **must** be `RANKS.indexOf(rank) + 1`.

Optional extras are ignored by the lobby: `lastScore`, `bestScore`, `round`, `won`, `sessionScore`, `roundsAtRank`, `family`, …

Load: `rank = RANKS.includes(stats.rank) ? stats.rank : "C"`.

### `"perNumber"`

Nine independent letters for skip counts **2 through 10**:

```json
{
  "ranks": {
    "2": "C", "3": "C", "4": "C", "5": "C",
    "6": "C", "7": "C", "8": "C", "9": "C", "10": "C"
  }
}
```

Lobby averages the nine letters for the spider spoke (each step C→S is 1/9 of the axis). Missing keys default to `"C"`. Some older code also reads letters off the stats root; **write `stats.ranks`**.

`difficultyLevel` is still 1–4 for the **current** number’s rank (what that run used). It is **not** what the lobby uses to fill the radar.

Optional: `lastSkipBy`, `lastScore`, `won`, `lastStep`.

### `"none"` (daily bonus titles)

No letter rank. Still call `saveProgress` if you want a stored session, e.g. `{ bestScore, lastScore, runs }` with `difficultyLevel: 1`. Do not set `stats.rank`. Catalog: `"bonus": true`, no `axisIndex`.

The bonus page **also gates** on `MathArcade.getDailyBonusUnlockStatus` before a run (fail-open if progress load fails). Integrate must keep that check; create-games for a new bonus should stub a local `unlocked` flag.

## Radar fill (lobby only; integrate must set catalog axes)

Topics in `TOPICS`: `addition`, `subtraction`, `multiplication`, `division`, `other`, plus `bonus` (not a radar).

Each non-bonus topic has **exactly five** axes (`axisIndex` 0–4, unique per topic). Empty axes: label `"Coming soon"`, score 0.

Letter → axis score: unplayed `0`, C `0.25`, B `0.5`, A `0.75`, S `1`.

Catalog fields for a math game:

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Lowercase, matches `GAME_ID`, URL file stem |
| `title` | yes | Lobby + `<title>` |
| `path` | yes | `/games/<id>.html` |
| `topic` | yes | One of the topic ids above |
| `axisIndex` | math yes | Integer 0–4, unique within topic |
| `axisLabel` | math yes | Short spoke label |
| `blurb` | yes | Preview panel |
| `howTo` | yes | How to play |
| `rankMode` | yes | `single` \| `perNumber` \| `none` |
| `bonus` | bonus only | `true` for endless-runner-style bonuses |

## Daily bonus unlock (lobby; games only contribute a timestamp)

Non-bonus catalog games with **any** `saveProgress` whose `updatedAt` is **local today** count. Unlock is not “ranked up today.” `DAILY_BONUS_REQUIRED_COUNT` in `common.js` is `null` ⇒ all catalog math games.

Timezone: server `UpdatedAt` is UTC; client treats timezone-less JSON timestamps as UTC (`parseServerTimestamp`).

Create-games: persist at least once per real play session (including a completed fail), not only on rank-up.

## HTML/CSS convention so integrate does not restyle

Copy these **class names** (colors stay CSS variables on that page):

- `rank-badge`, `rank-C`, `rank-B`, `rank-A`, `rank-S`
- `rank-legend`, `rank-up-banner`
- Overlay: `overlay`, `overlay-card`, `overlay-kicker`, `#overlay-title`, `#overlay-copy`, `#overlay-extra`, `#overlay-stats`, `.primary-btn`

HUD rank letter element should include `rank-C`…`rank-S` on the value node so the letter is themed.

Optional but useful: `rank-down-banner`, `end-stats` / `end-stat`.

Games load, after integrate:

```html
<script src="/js/common.js"></script>
<script src="/js/<id>.js"></script>
```

Skunkworks HTML **omits** `common.js`. Integrate adds the script tag and replaces stubs.

Do **not** link `wwwroot/css/games.css`. It is unused.

## Recommended persist stub (create-games)

```js
const GAME_ID = "yourgame"; // must match catalog id later
const RANK_MODE = "single"; // or "perNumber" | "none"

async function onScore(score) { /* no-op or localStorage best */ }
async function onSessionSave({ difficultyLevel, stats, keepalive }) { /* no-op */ }
```

On session end (win, fail, or hide):

- `onScore(Math.max(0, Math.floor(score)))`
- `onSessionSave({ difficultyLevel: rankLevel(rank), stats: { rank, ...optional }, keepalive })`

For `perNumber`, `stats` must be `{ ranks: { "2": "C", … } }` plus optional `lastSkipBy`.

Pagehide: if the session was real play, use `keepalive: true` so closing the tab still stamps `UpdatedAt`.
