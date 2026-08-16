# Skunkworks distillation brief

Instructions for the agent that will **mine MathArcade and produce the pattern library** used later to invent standalone games. **This distillation step may spend freely.** Read every game end-to-end. Prefer a superb 80-line snippet over a vague “see memorymatch.js.”

Do **not** build a shared runtime, npm package, or `import { GameShell }`. Games stay portable: one HTML file + one JS file a human could copy out of the arcade. The library is **worked examples to derive from**, plus notes — not a kit to dump unchanged. Distill by comparing titles; **finished skunkworks files must not name those titles** (create-agents cannot see this repo).

The skunkworks create-agent must be able to produce standalone games without reading the MathArcade repo. Your artifacts are what it reads instead.

---

## Mission

1. Audit every shipped game and take the **best** design for each UI, input, juice, and session element — not an average, not one “canonical game.”
2. Write those winners as small, themed-with-variables snippets a future agent can **derive from** without opening the source title. Header each snippet with what to reinvent (copy, palette, scale, juice), not “paste this.”
3. Document the **scoring / progress / catalog contract** exactly, so the game is ready for a separate integration step for a new, finished standalone game on MathArcade without needing to modify the standalone game schema.

Success looks like: a create-agent in a **separate workspace** can ship a new full-screen game from `AGENTS.md` + `PATTERNS.md` + following the wire persist/score from `CONTRACT.md`.

---

## Hard constraints (do not violate)

- **Standalone files.** No ES modules, no bundler, no shared CSS file that games must link. Inline `<style>` in the game HTML, same as today.
- **No single template game.** Memory Match is the best *chrome* source, not the best platformer or canvas game. Index by *element*, not by title.
- **Do not extract rank knobs into a framework.** `nextRank`, timers, grid size, factor ranges stay per-game. You may snippet the *state machine shape*, not a global config.
- **Do not revive or grow `wwwroot/css/games.css`.** It is an unused generic shell. Rank/HUD skins stay local; **class names** are the shared convention.
- **Do not put arcade lobby, radar, or daily-bonus UI into game snippets.** Those belong in `CONTRACT.md` so integrate can set catalog fields; create-games do not render spiders.
- **Lava Leap and Avalanche Run are one mechanic.** Distill one platform-jumper kit with direction (up vs down) and theme variables. Do not ship two 2,000-line clones as two patterns.
- **Snippets must run conceptually without `window.MathArcade`.** Persist through a tiny stub (`onSessionSave`, `onScore`) that integrate replaces. Document the real `MathArcade.*` signatures in `CONTRACT.md`.

---

## Suggested output layout

Write finished artifacts as **a few large files** (agents ingest them in one or two reads; do not shard into a folder per element). Header comments: what to change, CSS variables, when **not** to use — **no source-title names**.

```
skunkworks/AGENTS.md       Create-agent rules. Short. Invent a unique complementary fantasy; derive chrome + one mechanic; do not dump snippets.
skunkworks/CONTRACT.md     Scoring, progress, catalog, radar, daily bonus. No title names.
skunkworks/INTEGRATION.md  Cheap-agent checklist. No restyle. No title names.
skunkworks/PATTERNS.md     Whole library: chrome (always) + mechanics (pick one).
GAMES_AUDIT.md             Per-title metadata for *this* repo only — not inside skunkworks.
```

If a heading is not in `PATTERNS.md`, it does not exist.

---

## Method — find the best of each game

Token cost of *this* pass does not matter. Be thorough.

### 1. Inventory

Source of truth for titles is `wwwroot/js/common.js` → `GAMES` (not the README games table, which can lag). For each catalog id, read **all** of:

- `wwwroot/games/<id>.html` (especially the inline `<style>` and overlay/HUD markup)
- `wwwroot/js/<id>.js`
- How it calls `loadProgress` / `saveProgress` / `submitScore`

Also read `wwwroot/index.html`, `wwwroot/js/spider.js`, `wwwroot/css/site.css` only to document lobby/radar **contract** fields — do not turn them into game snippets.

### 2. Score elements, then pick a winner

For every element below, rank the implementations you actually find. Criteria (kid arcade, not demo code):

- **Clarity** — math stays readable; HUD does not fight the puzzle
- **Joy** — juice, audio, celebration, theme coherence
- **Reuse** — can strip the math and keep the shell
- **Kid robustness** — touch + mouse, reduced-motion, big hit targets, no hover-only
- **Accessibility** — `aria` on overlay/HUD, sound toggle, `prefers-reduced-motion`

The winner becomes the snippet. Runners-up become a one-line “variant” in the index (e.g. “Prime Search flashlight is unique; do not merge into overlay”). **Do not chimera two mediocre HUDs.** You may combine *clearly better parts* (Memory Match overlay markup + Calendar drag math) if you say so in the snippet header.

### 3. Elements to mine (minimum set)

Walk this list against every game. Add rows if you find a pattern that is truly distinct.

| Element | What “best” means here | Likely places to look first (verify; do not assume) |
|---|---|---|
| Page shell | Full-viewport `game-app`, fonts, `:root` tokens, no `games.css` | Memory Match HTML head/body |
| Topbar | Back to arcade, title, HUD chips, sound control; landscape-friendly | Memory Match, Feed the Cats |
| HUD chips | Rank letter, round, score; themed not generic grey | Memory Match; Calendar; per-number pickers on Lava/Avalanche |
| Overlay | Start / next-round / fail / rank-up; kicker, title, copy, extra, stats, primary button | Memory Match overlay DOM; Calendar victory/fail copy |
| Rank CSS | `.rank-badge`, `.rank-C`…`.rank-S`, `.rank-legend`, `.rank-up-banner`, `.end-stats` — **same class names**, colors via variables | Calendar (README exemplar); Avalanche ice S vs gold leak history |
| Rank JS shape | `RANKS`, `nextRank`, load `stats.rank` else `"C"`, optional S-fail demote | Calendar; Feed the Cats (3 rounds then promote) |
| Per-number ranks | ×2–×10 picker, `stats.ranks` map, speed knobs per letter | Lava Leap + Avalanche as **one** kit |
| Pointer drag | Pointer capture, click-to-pick fallback, drop targets, wrong-slot bounce | Calendar (months); Feed the Cats (cards); Make 10 (canvas wire — separate) |
| Card flip | 3D card, match/miss, keyboard | Memory Match |
| Tap world | Platforms *are* answers; camera; hazard | Lava/Avalanche |
| Canvas pointer | Elastic wire, node snap, decoys | Make 10 |
| Graph / map pick | Neighbors as choices, travel juice | Galaxy Maze |
| Memorize-then-hunt | Study phase, flashlight, reminder | Prime Search |
| Hand + slots | Deck, hand size, play into blanks, distractors | Feed the Cats |
| Timer curtain | Falling cover vs numeric bar | Calendar / Make 10 curtain; Feed the Cats S bar |
| Session length | 3 rounds → rank up vs 10 circuits vs clear-24 vs ×12 escape | Document as **design choices**, snippet the overlay+persist timing |
| Web Audio | One `ensureAudio` + scheduler + SFX helpers; **themed note tables** stay per-game | Compare all `ensureAudio` blocks; pick the cleanest API, not the longest song |
| Juice | Particles, confetti, shake, score pop, reduced-motion kill switch | Memory Match (DOM particles); Make 10 (canvas sparks) |
| SVG inline | Clone, unique ids, `data-expression` / palettes | `svg-assets/cat.svg` + Feed the Cats instancing — extract a **generic** inline-SVG helper, not cat-only |
| Sound pref | `localStorage` key `matharcade_<id>_sound` | Memory Match toggle |
| Pagehide persist | `keepalive` so a closed tab still counts as a session | Make 10 `flushSessionOnPageHide` |
| Bonus runner | No ranks; score = survival; still `saveProgress` | Dino Dash — only if making another bonus; not a math-game shell |

### 4. Per-game audit notes (starting hypotheses — replace with evidence)

Write `GAMES_AUDIT.md` with a section per title. For each: one paragraph of what it does better than the others, file paths, and “do not copy” traps (dead CSS, duplicated audio boilerplate, theme-specific class names).

| id | Title | Mine especially | Leave behind |
|---|---|---|---|
| `make10` | Make 10 | Canvas wire, decoys, A/S circuit timer, **keepalive session flush** | Do not treat as the overlay/HUD winner |
| `maze` | Galaxy Maze | Neighbor multiple-choice on a map, travel/scan juice, factor/decoy by rank | Starfield is theme, not a second overlay system |
| `skipcounting` | Lava Leap | Hazard-as-timer platform jumper, per-number ranks, pose SVG, combo | Merge with Avalanche; don’t ship two kits |
| `avalanche` | Avalanche Run | Same kit, countdown, **ice rank colors** (proof that skins must be local variables) | Don’t copy lava gold S-rank into ice |
| `primesearch` | Prime Search | Study → hunt, flashlight, mission reminder, board growth | Unique loop; don’t force it into card/drag snippets |
| `calendar` | Calendar Scramble | **Drag + click-to-place**, curtain timer, 3-round rank-up, wrong-slot −5, rank persist exemplar | Ordinal-month math stays in the game, not the drag kit |
| `memorymatch` | Memory Match Math | **Best chrome** (topbar, chips, overlay, sound, confetti, reduced-motion) | Flip-card CSS is for matching games, not every HUD |
| `feedthecats` | Feed the Cats | Hand/deck/slots, drag *and* select, SVG instance recolor, distractors, 12×3 promote, S clock | Don’t make every new game a 3,600-line café clone |
| `bonus` | Dino Dash | Endless runner juice; `rankMode: "none"` persist | Not a math shell; unlock logic is lobby-side |

Play or mentally walk start overlay → first success juice → fail/rank-up overlay. If juice is weak, say so; do not promote a pattern just because it exists.

---

## Scoring and progress contract

Put this in `CONTRACT.md` in the skunkworks. Integration must follow it exactly. Create-games implement the **blob shape** via stubs; they do not call the API until integrate.

### Identity (arcade host, not skunkworks)

- `localStorage` `matharcade_device_token` — UUID, created by `common.js`
- `localStorage` `matharcade_player_name`
- `MathArcade.ensurePlayer()` before `saveProgress` / `submitScore`, except `keepalive: true` pagehide paths (then skip if no name)
- No passwords. Admin is `X-Admin-Key` = `Admin:MagicWord` (not used by games)

### Two different numbers (do not conflate)

| Channel | API | Meaning |
|---|---|---|
| **Leaderboard score** | `POST /api/scores` | Non-negative integer. Server keeps **one best per player per game**. Lower scores are ignored. `gameId` is trimmed and lowercased. |
| **Progress / rank / daily bonus** | `PUT /api/progress/{gameId}` | `difficultyLevel` + `statsJson`. **Every successful save sets `UpdatedAt` (UTC).** A save today unlocks credit toward Dino Dash, **whether or not rank increased**. |

`submitScore` never writes rank. `saveProgress` never updates the high-score table. Typical session: both, score first or progress first is fine; Make 10 prefers **progress before score** on hide so the bonus still unlocks if score sync fails.

Client helpers (`wwwroot/js/common.js`):

```js
MathArcade.submitScore(gameId, score, { keepalive?: boolean })
MathArcade.saveProgress(gameId, difficultyLevel, stats, { keepalive?: boolean })
MathArcade.loadProgress(gameId)  // { gameId, difficultyLevel, statsJson, updatedAt?, exists }
```

`stats` may be an object (stringified by `saveProgress`) or a JSON string. Server stores whatever string it is given. Server clamps `difficultyLevel` to **1–20**; math games still send **1–4**.

Missing player → scores/progress POST/PUT 404 “Register first.” `GET` progress for unknown player or never-played game returns `exists: false`, `difficultyLevel: 1`, `statsJson: "{}"` (not an error).

### Rank letters (math games)

`RANKS = ["C", "B", "A", "S"]` in `common.js`.

**Never** restore rank from `difficultyLevel` alone. Old rows may have leftover numeric levels. If `stats.rank` is missing or not in `RANKS`, start at **C**.

Promotion knobs (how many rounds, timers, decoys) stay in the game. Shared shape:

```js
function nextRank(r) {
  const i = RANKS.indexOf(r);
  return RANKS[Math.min(RANKS.length - 1, i + 1)];
}
function rankLevel(rank) {
  return RANKS.indexOf(rank) + 1; // C=1 B=2 A=3 S=4
}
```

S-rank fail **may** demote to A (Calendar / Feed the Cats / Lava-style). That is a per-game rule; if you demote, persist the new letter immediately.

### `rankMode` (catalog field + stats blob)

Set on the `GAMES` entry. Lobby uses it in `getGameRankSummary`.

#### `"single"` (most math games)

Progress stats **must** include:

```json
{ "rank": "C" }
```

`difficultyLevel` **must** be `RANKS.indexOf(rank) + 1`.

Optional extra keys are allowed and ignored by the lobby (examples already in tree): `lastScore`, `bestScore`, `round`, `won`, `sessionScore`, `roundsAtRank`, `family`, … Keep extras useful for debugging, not required.

Load:

```js
rank = RANKS.includes(stats.rank) ? stats.rank : "C";
```

#### `"perNumber"` (Lava Leap `skipcounting`, Avalanche Run `avalanche`)

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

`difficultyLevel` for these titles is still 1–4 for the **current** number’s rank (what that run used). It is **not** what the lobby uses to fill the radar.

#### `"none"` (Dino Dash `bonus`)

No letter rank. Still call `saveProgress` if you want a stored session (e.g. `{ bestScore, lastScore, runs }`) with `difficultyLevel: 1`. Do not set `stats.rank`. Catalog: `"bonus": true`, no `axisIndex`.

### Radar fill (lobby only; integrate must set catalog axes)

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
| `bonus` | bonus only | `true` for Dino Dash-style |

### Daily bonus unlock (lobby; games only contribute a timestamp)

Non-bonus catalog games with **any** `saveProgress` whose `updatedAt` is **local today** count. Unlock is not “ranked up today.” `DAILY_BONUS_REQUIRED_COUNT` in `common.js` is `null` ⇒ all catalog math games. Timezone: server `UpdatedAt` is UTC; client treats timezone-less JSON timestamps as UTC (`parseServerTimestamp`).

Create-games: persist at least once per real play session (including a completed fail), not only on rank-up.

### HTML/CSS convention so integrate does not restyle

Copy these **class names** (colors stay CSS variables on that page):

- `rank-badge`, `rank-C`, `rank-B`, `rank-A`, `rank-S`
- `rank-legend`, `rank-up-banner`
- Overlay: `overlay`, `overlay-card`, `overlay-kicker`, `#overlay-title`, `#overlay-copy`, `#overlay-extra`, `#overlay-stats`, `.primary-btn`

HUD rank letter element should include `rank-C`…`rank-S` on the value node so the letter is themed.

Games load, after integrate:

```html
<script src="/js/common.js"></script>
<script src="/js/<id>.js"></script>
```

Skunkworks HTML should **omit** `common.js` (or guard all `MathArcade` use). Integrate adds the script tag and replaces stubs.

### Recommended persist stub for new games

In skunkworks JS:

```js
const GAME_ID = "yourgame"; // must match catalog id later
const RANK_MODE = "single"; // or "perNumber" | "none"

async function onScore(score) { /* no-op or localStorage best */ }
async function onSessionSave({ difficultyLevel, stats, keepalive }) { /* no-op */ }
```

On session end (win, fail, or hide):

- `onScore(Math.max(0, Math.floor(score)))`
- `onSessionSave({ difficultyLevel: rankLevel(rank), stats: { rank, ...optional }, keepalive })`

Integrate maps those to `MathArcade.submitScore` / `saveProgress`. For `perNumber`, `stats` must be `{ ranks: { "2": "C", … } }` plus optional `lastSkipBy`.

Pagehide: if the session was real play, use `keepalive: true` so closing the tab still stamps `UpdatedAt` (see Make 10).

---

## Create-agent vs integrate-agent (write this into AGENTS.md / INTEGRATION.md)

**Create (expensive model, separate workspace):** Invent a unique complementary fantasy. Derive chrome and one mechanic from `PATTERNS.md` (inspiration, not a paste kit). Theme with CSS variables, rewrite copy, meet kid-scale sizes, write a unique short music bed. Ship HTML+JS that run opened as static files. Do not read MathArcade. Do not launch an explore subagent. Do not open a previous full game “for juice.” One conversation; stop shortly after the files exist.

**Integrate (cheap model, this repo):** Append `GAMES` entry; drop files into `wwwroot/games/` and `wwwroot/js/`; add `common.js` script; wire stubs to `MathArcade`; keep class names. **No restyle, no juice pass, no “match the other games.”**

If a snippet needs arcade knowledge, that knowledge belongs in `CONTRACT.md`, not in the create-agent’s context.

---

## Quality bar for snippets

- Header: what to reinvent (copy, palette, scale, juice), CSS variables, when **not** to use it. No shipped-title names in skunkworks files.
- Snippets are inspiration. Tell the create-agent to derive a complementary flavor — not to paste chrome/mechanics unchanged.
- Runnable fragment or drop-in functions; not “adapt lines 872–1140.”
- Theme only through variables (`--ink`, `--accent`, `--paper`, `--topbar-bg`, `--overlay-dim`, `--kicker-bg`, …). Rank badge hues included. Light vs dark chrome must both work.
- Kid scale: hero type, hit targets (~3.25rem+), mascots (~120px / ~22% of stage), few on-screen choices. Call out pixel sizes that would look like stickers.
- Strip game-specific math, copy, and palettes except as comments/examples.
- Prefer ~40–200 lines per snippet. If a “snippet” exceeds ~400 lines, split (shell vs audio vs juice).
- Web Audio: helper shape + a skeleton bed the create-agent must replace (chords/BPM/waveform). Not nine full soundtracks, and not “loop the example SFX.”
- Reduced-motion: every juice snippet must honor `prefers-reduced-motion`.

---

## Out of scope for distillation

- Changing MathArcade gameplay or refactoring shipped games (unless the user asks).
- Implementing the next title.
- Moving rank knobs into `common.js`.
- Linking `games.css` from full-screen games.

When the library is done, a create-agent should be able to build a new standalone game without this repository, and a cheap integrate-agent should be able to attach it using only `CONTRACT.md` and `INTEGRATION.md`.
