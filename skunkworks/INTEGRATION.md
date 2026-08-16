# Integrate-agent checklist

Cheap pass. Drop a finished standalone game into the arcade. **No restyle, no juice pass, no matching other titles.**

The create-agent already shipped one HTML + one JS that run as static files, using stubs `onScore` / `onSessionSave`.

## 1. Identity

- `[ ]` `GAME_ID` is lowercase, matches the HTML file stem and catalog `id`
- `[ ]` `RANK_MODE` is `single`, `perNumber`, or `none`
- `[ ]` Topic has a free `axisIndex` 0–4 (skip for bonus)

## 2. Files

- `[ ]` Copy HTML → `wwwroot/games/<id>.html`
- `[ ]` Copy JS → `wwwroot/js/<id>.js`
- `[ ]` In the HTML, **add** (do not replace the game script):

```html
<script src="/js/common.js"></script>
<script src="/js/<id>.js"></script>
```

- `[ ]` Do **not** link `css/games.css`
- `[ ]` Keep inline `<style>` and class names (`overlay`, `rank-badge`, `rank-C`…`rank-S`, …)

## 3. Wire stubs → MathArcade

Replace no-op stubs. Do not change gameplay.

```js
async function onScore(score, options = {}) {
  if (!window.MathArcade) return;
  return MathArcade.submitScore(GAME_ID, Math.max(0, Math.floor(score)), options);
}

async function onSessionSave({ difficultyLevel, stats, keepalive }) {
  if (!window.MathArcade) return;
  return MathArcade.saveProgress(GAME_ID, difficultyLevel, stats, { keepalive: !!keepalive });
}
```

On boot, if the game already has a `loadRank` / `rankFromProgress` helper, point it at `MathArcade.loadProgress(GAME_ID)`.

Pagehide path must pass `{ keepalive: true }` and **skip prompting** for a name (helpers already do this). Save **progress before score** on hide.

## 4. Catalog row (`wwwroot/js/common.js` → `GAMES`)

Append one object. Required math fields: `id`, `title`, `path`, `topic`, `axisIndex`, `axisLabel`, `blurb`, `howTo`, `rankMode`.

Bonus only: `bonus: true`, `rankMode: "none"`, no `axisIndex`.

`path` is `/games/<id>.html`.

## 5. Blob check

- `single` → `stats.rank` is `C|B|A|S`; `difficultyLevel` is 1–4
- `perNumber` → `stats.ranks` has keys `"2"`…`"10"`; do not rely on root-level letters
- `none` → no `stats.rank`; `difficultyLevel: 1`

Persist on fail as well as win (daily bonus is “played today,” not “ranked up”).

## 6. Stop

Do not restyle colors or rewrite copy. Class names are the shared convention; skins stay on the page.
