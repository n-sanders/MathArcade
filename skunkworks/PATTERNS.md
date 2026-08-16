# Pattern library

Ingest this whole file. **Chrome** ships in every math game. **Mechanics:** pick one heading (two only if they compose). If a heading is not here, it does not exist.

Theme only through CSS variables (`--ink`, `--accent`, `--paper`, rank hues). No shared CSS file, no `import`, no `window.MathArcade`.

---

# Chrome (always)

## Page shell

Full-viewport lock, fonts, tokens, reduced-motion kill. Do not link a shared stylesheet. Omit `common.js` until integrate.

**Change:** title, `--accent` tokens, stage inner markup, script filename.
**When not:** a canvas bonus may skip the frosted stage frame, but still use `game-app` + `100dvh`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#7c4dff" />
  <title>Your Game</title>
  <link rel="icon" href="data:," />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    :root {
      --ink: #39245b;
      --ink-soft: #674f86;
      --accent: #7c4dff;
      --accent-deep: #5b2bd7;
      --accent-hot: #ff5ea8;
      --paper: rgba(255, 255, 255, 0.86);
      --cream: #fffaf0;
      --font-display: "Fredoka", "Nunito", system-ui, sans-serif;
      --font-body: "Nunito", system-ui, sans-serif;
      --topbar-height: 4.15rem;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
    body {
      color: var(--ink);
      font-family: var(--font-body);
      background: var(--cream);
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    button, a { font: inherit; }
    .game-app {
      position: relative;
      isolation: isolate;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      width: 100%;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
    }
    .game-stage { position: relative; min-height: 0; overflow: hidden; }
    .effects { position: absolute; inset: 0; z-index: 7; overflow: hidden; pointer-events: none; }
    .message {
      position: absolute; left: 50%; bottom: 0.8rem; z-index: 8;
      max-width: min(90vw, 38rem); margin: 0; padding: 0.55rem 1rem;
      transform: translate(-50%, 150%); opacity: 0; pointer-events: none;
      border-radius: 999px; background: var(--paper); font-weight: 900; text-align: center;
    }
    .message.show { transform: translate(-50%, 0); opacity: 1; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 1ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 1ms !important;
      }
      .fx-particle, .confetti, .round-ribbon { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="game-app">
    <!-- topbar -->
    <main class="game-stage" id="stage">
      <div class="effects" id="effects" aria-hidden="true"></div>
      <p class="message" id="message" role="status" aria-live="polite" aria-atomic="true"></p>
      <!-- overlay -->
    </main>
  </div>
  <script src="yourgame.js"></script>
</body>
</html>
```

## Topbar

Back link, title, HUD slot, sound control. Landscape-friendly grid. Never skip the back link on an arcade game.

```html
<style>
  .topbar {
    position: relative; z-index: 20; min-height: var(--topbar-height);
    display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center; gap: 0.8rem;
    padding: 0.55rem clamp(0.65rem, 2vw, 1.4rem);
    border-bottom: 2px solid rgba(255, 255, 255, 0.65);
    background: var(--paper);
    backdrop-filter: blur(14px) saturate(1.25);
  }
  .brand { min-width: 0; display: flex; align-items: center; gap: clamp(0.5rem, 1.5vw, 1rem); }
  .back-link {
    display: inline-flex; align-items: center; min-height: 2.35rem;
    padding: 0.45rem 0.75rem; color: var(--accent-deep);
    border: 2px solid color-mix(in srgb, var(--accent) 16%, transparent);
    border-radius: 999px; background: rgba(255, 255, 255, 0.65);
    font-weight: 900; text-decoration: none; white-space: nowrap;
  }
  .game-title {
    min-width: 0; margin: 0; color: var(--accent-deep);
    font-family: var(--font-display);
    font-size: clamp(1.15rem, 2.3vw, 1.65rem); font-weight: 700;
    line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .controls { display: flex; justify-content: flex-end; }
  .sound-toggle {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
    min-width: 2.75rem; min-height: 2.65rem; padding: 0.45rem 0.78rem;
    color: var(--accent-deep); border-radius: 999px; cursor: pointer; font-weight: 900;
    border: 2px solid color-mix(in srgb, var(--accent) 15%, transparent);
    background: rgba(255, 255, 255, 0.82);
  }
  .sound-toggle[aria-pressed="false"] { color: var(--ink-soft); opacity: 0.75; }
  @media (max-width: 780px) {
    :root { --topbar-height: 5.9rem; }
    .topbar {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: "brand controls" "hud hud";
    }
    .brand { grid-area: brand; } .hud { grid-area: hud; } .controls { grid-area: controls; }
  }
  @media (max-width: 470px) {
    .control-label { display: none; }
    .sound-toggle { min-width: 2.4rem; min-height: 2.3rem; padding: 0.35rem; }
  }
  @media (max-height: 560px) and (orientation: landscape) {
    :root { --topbar-height: 3.25rem; }
    .topbar { grid-template-areas: "brand hud controls"; padding: 0.28rem 0.55rem; }
  }
</style>
<header class="topbar">
  <div class="brand">
    <a class="back-link" href="/" aria-label="Back to the arcade">← Arcade</a>
    <h1 class="game-title">Your Game</h1>
  </div>
  <!-- HUD chips -->
  <div class="controls">
    <button class="sound-toggle" id="sound-toggle" type="button" aria-pressed="true" aria-label="Turn sound off">
      <span class="sound-icon" id="sound-icon" aria-hidden="true">♪</span>
      <span class="control-label" id="sound-label">Sound on</span>
    </button>
  </div>
</header>
```

## HUD chips

Labeled uppercase chips. Put `rank-C`…`rank-S` on the **value** node, not the chip.

**Change:** extra chips (round, pairs, combo). Per-number games add `×n · rank`. Bonus uses Speed / HI / Score with no letter.

```html
<style>
  .hud { display: flex; align-items: center; justify-content: center; gap: clamp(0.3rem, 1vw, 0.6rem); white-space: nowrap; }
  .hud-chip {
    display: grid; grid-template-columns: auto auto; align-items: baseline; gap: 0.28rem;
    min-height: 2.55rem; padding: 0.38rem 0.72rem; border-radius: 15px;
    border: 2px solid color-mix(in srgb, var(--accent) 12%, transparent);
    background: rgba(255, 255, 255, 0.78); color: var(--ink-soft);
    font-size: 0.76rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.055em;
  }
  .hud-value {
    color: var(--accent-deep); font-family: var(--font-display);
    font-size: 1.12rem; font-weight: 700; letter-spacing: 0; text-transform: none;
  }
  .hud-value.rank-C { color: var(--rank-c, #4a4a56); }
  .hud-value.rank-B { color: var(--rank-b, #0f7a48); }
  .hud-value.rank-A { color: var(--rank-a, #2a4fd4); }
  .hud-value.rank-S { color: var(--rank-s, #b45309); }
  .hud-chip.score-bump { animation: score-bump 420ms cubic-bezier(0.2, 1.6, 0.4, 1); }
  @keyframes score-bump {
    0%, 100% { transform: scale(1); }
    45% { transform: translateY(-3px) scale(1.12); }
  }
</style>
<div class="hud" aria-label="Game progress">
  <div class="hud-chip"><span>Rank</span><strong class="hud-value rank-C" id="rank-value">C</strong></div>
  <div class="hud-chip"><span>Round</span><strong class="hud-value" id="round-value">1</strong></div>
  <div class="hud-chip" id="score-chip"><span>Score</span><strong class="hud-value" id="score-value">0</strong></div>
</div>
```

## Overlay

Dialog shell: kicker, title, copy, extra, stats, primary button. Mutate these nodes; do not rebuild the card innerHTML each time. Hide with `.hidden` (opacity/visibility), not `display: none`.

**Class names are a contract:** `overlay`, `overlay-card`, `overlay-kicker`, `#overlay-title`, `#overlay-copy`, `#overlay-extra`, `#overlay-stats`, `.primary-btn`.

```html
<style>
  .overlay {
    position: absolute; inset: 0; z-index: 15; display: grid; place-items: center; padding: 1rem;
    background: rgba(109, 70, 188, 0.22); backdrop-filter: blur(8px) saturate(1.15);
    transition: opacity 260ms ease, visibility 260ms ease;
  }
  .overlay.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
  .overlay-card {
    width: min(92vw, 34rem); padding: clamp(1.25rem, 4vw, 2.3rem); text-align: center;
    border: 4px solid rgba(255, 255, 255, 0.84); border-radius: clamp(1.6rem, 4vw, 2.5rem);
    background: linear-gradient(145deg, rgba(255,255,255,0.98), var(--paper));
    animation: overlay-arrive 520ms cubic-bezier(0.16, 1.35, 0.42, 1) both;
  }
  @keyframes overlay-arrive {
    from { opacity: 0; transform: translateY(24px) scale(0.9); }
    to { opacity: 1; transform: none; }
  }
  .overlay-kicker {
    display: inline-block; margin-bottom: 0.55rem; padding: 0.3rem 0.78rem;
    color: var(--accent-hot); border-radius: 999px; background: #ffe3f1;
    font-size: 0.76rem; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;
  }
  .overlay h2 {
    margin: 0; color: var(--accent-deep); font-family: var(--font-display);
    font-size: clamp(2.15rem, 8vw, 4rem); font-weight: 700; line-height: 0.96;
  }
  .overlay-copy {
    max-width: 34ch; margin: 0.85rem auto 1.2rem; color: var(--ink-soft);
    font-size: clamp(0.95rem, 2.5vw, 1.12rem); font-weight: 800; line-height: 1.45;
  }
  #overlay-extra { width: 100%; margin: 0 auto 1rem; }
  .overlay-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; margin: 0 auto 1.15rem; }
  .overlay-stats[hidden] { display: none; }
  .overlay-stat { padding: 0.65rem; border-radius: 16px; background: color-mix(in srgb, var(--accent) 10%, white); }
  .overlay-stat strong { display: block; font-family: var(--font-display); font-size: clamp(1.25rem, 4vw, 1.8rem); }
  .overlay-stat span { display: block; font-size: 0.72rem; font-weight: 900; letter-spacing: 0.055em; text-transform: uppercase; }
  .primary-btn {
    min-width: 12rem; min-height: 3.25rem; padding: 0.75rem 1.65rem; color: #fff; border: 0;
    border-radius: 999px; cursor: pointer; font-family: var(--font-display); font-size: 1.12rem; font-weight: 700;
    background: linear-gradient(135deg, var(--accent-hot), var(--accent));
    box-shadow: 0 7px 0 var(--accent-deep);
  }
  .end-stats { display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; margin: 0.5rem auto; }
  .end-stat { border-radius: 12px; padding: 0.55rem 0.9rem; min-width: 90px; text-align: center; background: color-mix(in srgb, var(--accent) 8%, white); }
  .end-stat .lbl { display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
  .end-stat .num { font-family: var(--font-display); font-size: 1.35rem; font-weight: 700; }
</style>
<section class="overlay" id="overlay" role="dialog" aria-modal="true" aria-labelledby="overlay-title">
  <div class="overlay-card">
    <span class="overlay-kicker" id="overlay-kicker">How to play</span>
    <h2 id="overlay-title">Your Game</h2>
    <p class="overlay-copy" id="overlay-copy">Short kid-facing rules. One or two sentences.</p>
    <div id="overlay-extra"></div>
    <div class="overlay-stats" id="overlay-stats" hidden>
      <div class="overlay-stat"><strong id="stat-a">0</strong><span>Round points</span></div>
      <div class="overlay-stat"><strong id="stat-b">0</strong><span>Session total</span></div>
    </div>
    <button class="primary-btn" id="overlay-action" type="button">Play</button>
  </div>
</section>
```

```js
function showOverlay() {
  overlayEl.classList.remove("hidden");
  overlayEl.setAttribute("aria-hidden", "false");
  window.setTimeout(() => overlayActionEl.focus({ preventScroll: true }), 180);
}
function hideOverlay() {
  overlayEl.classList.add("hidden");
  overlayEl.setAttribute("aria-hidden", "true");
}
function paintStartOverlay() {
  overlayKickerEl.textContent = "How to play";
  overlayTitleEl.textContent = "Your Game";
  overlayCopyEl.textContent = "Short rules. Climb C → S.";
  overlayExtraEl.innerHTML = rankLegendHtml();
  overlayStatsEl.hidden = true;
  overlayActionEl.textContent = "Play";
  showOverlay();
}
function paintEndOverlay({ rankedUp, oldRank, rank, failed, demoted, score, sessionScore }) {
  overlayKickerEl.textContent = rankedUp ? "Rank up" : failed ? "Try again" : "Nice work";
  overlayTitleEl.textContent = rankedUp ? "Rank Up!" : failed ? "So close!" : "You did it!";
  overlayCopyEl.textContent = rankedUp
    ? `The challenge grew — ${oldRank} → ${rank}.`
    : failed ? "Take another run whenever you are ready." : "Clear the goal again to keep climbing.";
  const banner = rankedUp
    ? `<div class="rank-up-banner">RANK UP! ${oldRank} → ${rank}</div>`
    : demoted ? `<div class="rank-down-banner">Rank down ${oldRank} → ${rank}</div>` : "";
  overlayExtraEl.innerHTML = `
    ${banner}
    <div class="end-stats">
      <div class="end-stat"><span class="lbl">Score</span><span class="num">${score}</span></div>
      <div class="end-stat"><span class="lbl">Rank</span><span class="num rank-${rank}">${rank}</span></div>
    </div>
    ${rankLegendHtml()}`;
  overlayStatsEl.hidden = sessionScore == null;
  overlayActionEl.textContent = "Play again";
  showOverlay();
}
```

## Rank CSS

Same **class names** everywhere; retint with variables. Do not invent `rank-gold` / extra S classes. Two games can share `.rank-S` with different `--rank-s-*` skins.

```css
:root {
  --rank-c: #4a4a56;
  --rank-b: #0f7a48;
  --rank-a: #2a4fd4;
  --rank-s: #b45309;
  --rank-s-bg: linear-gradient(135deg, rgba(255, 196, 56, 0.45), rgba(255, 122, 64, 0.32));
  --rank-s-glow: rgba(255, 176, 40, 0.28);
}
.rank-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 2rem; padding: 0.12rem 0.45rem; border-radius: 8px;
  font-family: var(--font-display); font-weight: 700; font-size: 0.85rem;
  letter-spacing: 0.06em; border: 1px solid transparent;
}
.rank-C { background: rgba(92, 92, 104, 0.12); color: var(--rank-c); border-color: rgba(74, 74, 86, 0.35); }
.rank-B { background: rgba(18, 148, 86, 0.14); color: var(--rank-b); border-color: rgba(15, 122, 72, 0.4); }
.rank-A { background: rgba(59, 95, 217, 0.14); color: var(--rank-a); border-color: rgba(42, 79, 212, 0.4); }
.rank-S {
  background: var(--rank-s-bg); color: var(--rank-s);
  border-color: color-mix(in srgb, var(--rank-s) 45%, transparent);
  box-shadow: 0 0 10px var(--rank-s-glow);
  animation: sGlow 1.8s ease-in-out infinite;
}
@keyframes sGlow { 50% { box-shadow: 0 0 20px var(--rank-s-glow); } }
.rank-legend {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 0.45rem 0.75rem;
  margin: 0.35rem auto; font-size: 0.78rem; color: var(--ink-soft); max-width: 42ch;
}
.rank-legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
.rank-up-banner {
  margin: 0.35rem auto; padding: 0.55rem 0.95rem; border-radius: 12px;
  font-family: var(--font-display); font-weight: 700; color: var(--accent-deep);
  background: linear-gradient(90deg, color-mix(in srgb, var(--rank-s) 35%, white), color-mix(in srgb, var(--accent-hot) 22%, white));
  animation: rankPop 0.6s ease;
}
.rank-down-banner {
  margin: 0.35rem auto; padding: 0.55rem 0.95rem; border-radius: 12px;
  font-family: var(--font-display); font-weight: 700; color: var(--ink-soft);
  background: rgba(74, 44, 29, 0.08); border: 1px solid rgba(74, 44, 29, 0.25);
  animation: rankPop 0.6s ease;
}
@keyframes rankPop {
  0% { transform: scale(0.7); opacity: 0; }
  60% { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
}
```

## Rank JS + persist stubs

Never restore rank from `difficultyLevel`. Promotion knobs stay in your game. Integrate replaces `onScore` / `onSessionSave`.

```js
const GAME_ID = "yourgame";
const RANK_MODE = "single"; // "single" | "perNumber" | "none"
const RANKS = ["C", "B", "A", "S"];
const RANK_FLAVOR = { C: "warm-up", B: "steady", A: "spicy", S: "master" };

function nextRank(r) {
  const i = RANKS.indexOf(r);
  return RANKS[Math.min(RANKS.length - 1, i + 1)];
}
function rankLevel(rank) { return RANKS.indexOf(rank) + 1; }
function parseRank(stats) { return RANKS.includes(stats && stats.rank) ? stats.rank : "C"; }
function rankLegendHtml() {
  return `<div class="rank-legend">
    <span><span class="rank-badge rank-C">C</span> ${RANK_FLAVOR.C}</span>
    <span><span class="rank-badge rank-B">B</span> ${RANK_FLAVOR.B}</span>
    <span><span class="rank-badge rank-A">A</span> ${RANK_FLAVOR.A}</span>
    <span><span class="rank-badge rank-S">S</span> ${RANK_FLAVOR.S}</span>
  </div>`;
}
function paintRankHud(rank) {
  const el = document.getElementById("rank-value");
  if (!el) return;
  el.textContent = rank;
  el.className = "hud-value rank-" + rank;
}
function maybeDemoteOnFail(rank, { onlyIfS = true } = {}) {
  if (onlyIfS && rank === "S") return "A";
  return rank;
}

async function onScore(score) {
  try {
    const key = "matharcade_" + GAME_ID + "_best";
    const best = Math.max(Number(localStorage.getItem(key) || 0), Math.max(0, Math.floor(score)));
    localStorage.setItem(key, String(best));
  } catch (_) {}
}
async function onSessionSave({ difficultyLevel, stats, keepalive }) {
  try {
    localStorage.setItem("matharcade_" + GAME_ID + "_stats", JSON.stringify(stats || {}));
  } catch (_) {}
}
function loadLocalStats() {
  try { return JSON.parse(localStorage.getItem("matharcade_" + GAME_ID + "_stats") || "{}"); }
  catch (_) { return {}; }
}
async function persistSession({ rank, score, extra, keepalive }) {
  const stats = RANK_MODE === "none" ? { ...(extra || {}) } : { rank, ...(extra || {}) };
  await onScore(Math.max(0, Math.floor(score)), { keepalive });
  await onSessionSave({
    difficultyLevel: RANK_MODE === "none" ? 1 : rankLevel(rank),
    stats,
    keepalive
  });
}
```

## Web Audio

Mute-gated `ensureAudio`, three buses (`master` / `music` / `sfx`), destination-aware `playTone`. Themed note tables stay in *your* `playCorrect` / `playWrong` — not a full soundtrack here.

```js
let audioContext = null, masterGain = null, musicGain = null, sfxGain = null;
let audioUnavailable = false, musicTimer = 0;

function ensureAudio() {
  if (!soundEnabled || audioUnavailable) return null;
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { audioUnavailable = true; updateSoundControl(); return null; }
    try {
      audioContext = new Ctx();
      masterGain = audioContext.createGain();
      musicGain = audioContext.createGain();
      sfxGain = audioContext.createGain();
      masterGain.gain.value = 0.82;
      musicGain.gain.value = 0.28;
      sfxGain.gain.value = 0.8;
      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(audioContext.destination);
    } catch (_) { audioUnavailable = true; return null; }
  }
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}
function playTone(destination, options) {
  const context = ensureAudio();
  if (!context || !destination) return;
  const start = options.time ?? context.currentTime;
  const duration = options.duration ?? 0.18;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = options.type || "sine";
  osc.frequency.setValueAtTime(Math.max(1, options.frequency), start);
  if (options.endFrequency) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), start + duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(options.gain ?? 0.12, start + (options.attack ?? 0.008));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain); gain.connect(destination);
  osc.start(start); osc.stop(start + duration + 0.05);
}
function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = 0; }
  if (audioContext && musicGain) {
    musicGain.gain.cancelScheduledValues(audioContext.currentTime);
    musicGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.04);
  }
}
function examplePatch(kind) {
  const context = ensureAudio();
  if (!context) return;
  const now = context.currentTime;
  if (kind === "ok") {
    [523.25, 659.25].forEach((f, i) => playTone(sfxGain, { type: "triangle", frequency: f, time: now + i * 0.07, duration: 0.16, gain: 0.1 }));
  } else if (kind === "bad") {
    playTone(sfxGain, { type: "sawtooth", frequency: 220, endFrequency: 90, duration: 0.22, gain: 0.08 });
  } else if (kind === "rankup") {
    [392, 523, 659, 784].forEach((f, i) => playTone(sfxGain, { type: "triangle", frequency: f, time: now + i * 0.09, duration: 0.28, gain: 0.14 }));
  }
}
document.addEventListener("visibilitychange", () => { if (document.hidden) stopMusic(); });
```

## Sound preference

Key: `matharcade_<id>_sound`. Values `"on"` / `"off"`. **Default on** if missing (`!== "off"`). Do not use a `MUTE_KEY` name.

```js
const SOUND_KEY = "matharcade_" + GAME_ID + "_sound";
let soundEnabled = readSoundPreference();
function readSoundPreference() {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch (_) { return true; }
}
function storeSoundPreference() {
  try { localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off"); } catch (_) {}
}
function updateSoundControl() {
  const btn = document.getElementById("sound-toggle");
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(soundEnabled));
  btn.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
  const icon = document.getElementById("sound-icon");
  const label = document.getElementById("sound-label");
  if (icon) icon.textContent = soundEnabled ? "♪" : "×";
  if (label) label.textContent = soundEnabled ? "Sound on" : "Sound off";
  if (audioUnavailable) { btn.disabled = true; btn.title = "Web Audio is not supported"; }
}
function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  storeSoundPreference();
  updateSoundControl();
  if (!soundEnabled) {
    stopMusic();
    if (audioContext && masterGain) {
      masterGain.gain.cancelScheduledValues(audioContext.currentTime);
      masterGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.025);
    }
    return;
  }
  const context = ensureAudio();
  if (!context || !masterGain) return;
  masterGain.gain.cancelScheduledValues(context.currentTime);
  masterGain.gain.setTargetAtTime(0.82, context.currentTime, 0.025);
}
document.getElementById("sound-toggle")?.addEventListener("click", () => setSoundEnabled(!soundEnabled));
updateSoundControl();
```

## Pagehide persist

If the kid actually played (including a fail), flush on `pagehide` with `keepalive: true`. **Progress before score** so a daily-bonus stamp still lands if score sync fails.

```js
let sessionDirty = false;
function markSessionReal() { sessionDirty = true; }
function flushSessionOnPageHide() {
  stopMusic();
  if (!sessionDirty) return;
  const rank = window.currentRank || "C";
  const score = Math.max(0, Math.floor(window.currentScore || 0));
  const extra = RANK_MODE === "perNumber"
    ? { ranks: window.ranksBySkip, lastScore: score, won: false }
    : { lastScore: score, won: false };
  void persistSession({ rank, score, extra, keepalive: true });
}
window.addEventListener("pagehide", flushSessionOnPageHide);
```

## DOM juice

Particles, score pop, confetti, ribbon. Every function starts with `if (reducedMotion) return`.

```js
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = reducedMotionQuery.matches;
reducedMotionQuery.addEventListener?.("change", (e) => { reducedMotion = e.matches; });
const BURST_COLORS = ["var(--accent-hot)", "var(--accent)", "#ffd84d", "#37d8e6"];

function spawnBurst(x, y, points) {
  if (reducedMotion) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement("span");
    p.className = "fx-particle";
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
    p.style.setProperty("--x", x + "px");
    p.style.setProperty("--y", y + "px");
    p.style.setProperty("--dx", Math.cos(a) * d + "px");
    p.style.setProperty("--dy", Math.sin(a) * d + "px");
    p.style.setProperty("--color", BURST_COLORS[i % BURST_COLORS.length]);
    p.addEventListener("animationend", () => p.remove(), { once: true });
    effectsEl.append(p);
  }
  const pop = document.createElement("span");
  pop.className = "score-pop";
  pop.textContent = "+" + points;
  pop.style.setProperty("--x", x + "px");
  pop.style.setProperty("--y", y + "px");
  pop.addEventListener("animationend", () => pop.remove(), { once: true });
  effectsEl.append(pop);
}
function celebrateRound(label) {
  if (reducedMotion) return;
  for (let i = 0; i < 76; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.setProperty("--left", Math.random() * 100 + "%");
    piece.style.setProperty("--color", BURST_COLORS[i % BURST_COLORS.length]);
    piece.style.setProperty("--drift", (Math.random() * 240 - 120) + "px");
    piece.style.setProperty("--fall-time", 1700 + Math.random() * 1300 + "ms");
    piece.addEventListener("animationend", () => piece.remove(), { once: true });
    effectsEl.append(piece);
  }
  const ribbon = document.createElement("span");
  ribbon.className = "round-ribbon";
  ribbon.textContent = label || "Cleared!";
  ribbon.addEventListener("animationend", () => ribbon.remove(), { once: true });
  effectsEl.append(ribbon);
}
```

```css
.fx-particle {
  position: absolute; left: var(--x); top: var(--y); width: 10px; aspect-ratio: 1; border-radius: 50%;
  background: var(--color); pointer-events: none; transform: translate(-50%, -50%) scale(0);
  animation: particle-burst 720ms cubic-bezier(0.15, 0.7, 0.3, 1) forwards;
}
.score-pop {
  position: absolute; left: var(--x); top: var(--y); font-family: var(--font-display); font-weight: 700;
  pointer-events: none; animation: score-float 900ms cubic-bezier(0.2, 1.2, 0.4, 1) forwards;
}
.confetti {
  position: absolute; top: -8%; left: var(--left); width: 9px; height: 17px; background: var(--color);
  pointer-events: none; animation: confetti-fall var(--fall-time, 2s) cubic-bezier(0.16, 0.72, 0.44, 1) forwards;
}
.round-ribbon {
  position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%) scale(0);
  padding: 0.55rem 1.35rem; border-radius: 999px; color: #fff; pointer-events: none;
  background: linear-gradient(135deg, var(--accent-hot), var(--accent));
  font-family: var(--font-display); font-weight: 700;
  animation: ribbon-pop 1050ms cubic-bezier(0.18, 1.45, 0.4, 1) forwards;
}
@keyframes particle-burst {
  18% { opacity: 1; }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1); }
}
@keyframes score-float {
  22% { opacity: 1; transform: translate(-50%, -35%) scale(1.2); }
  100% { opacity: 0; transform: translate(-50%, -180%) scale(0.92); }
}
@keyframes confetti-fall {
  10% { opacity: 1; }
  100% { transform: translate3d(var(--drift), 115vh, 0); }
}
@keyframes ribbon-pop {
  22% { opacity: 1; transform: translate(-50%, -50%) scale(1.12); }
  100% { opacity: 0; transform: translate(-50%, -120%) scale(0.96); }
}
```

## Inline SVG helper

Clone a hidden `<template>`, rewrite a shared id prefix (clip/filter collisions), paint with CSS variables, optional `data-expression`. Do not paste a 200-line character as the pattern.

```js
let svgSeq = 0;
function spawnSvg(holder, palette) {
  svgSeq += 1;
  const uid = "g" + svgSeq;
  const template = document.getElementById("svg-template");
  holder.innerHTML = template.innerHTML.replaceAll("asset-", "asset-" + uid + "-");
  const svg = holder.querySelector("svg");
  if (!svg) return null;
  svg.classList.add("recolorable");
  svg.setAttribute("data-expression", "neutral");
  Object.keys(palette).forEach((name) => svg.style.setProperty(name, palette[name]));
  return svg;
}
```

---

# Mechanics (pick one)

## Pointer drag

DOM tiles onto slots, with click-to-place fallback (unmoved pointer-up selects; next click on a slot places). Compare `tile.slotId === target.id` — do not assume index identity. Document-level `pointermove`/`pointerup` so the pointer can leave the tile. Wrong slot: bounce home, typically −5.

**When not:** canvas wire; flip cards.

```js
const DRAG_THRESHOLD = 12;
let drag = null, held = null;
function toStage(e) {
  const r = stage.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function findTargetSlot(x, y) {
  const PAD = 10;
  let best = null, bestDist = Infinity;
  for (const s of slots) {
    if (s.filled || !s.rect) continue;
    const r = s.rect;
    if (x < r.left - PAD || x > r.right + PAD || y < r.top - PAD || y > r.bottom + PAD) continue;
    const d = Math.hypot(x - r.cx, y - r.cy);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}
function tryPlace(tile, target) {
  if (!target) return false;
  if (target.id === tile.slotId) onCorrect(tile, target);
  else onWrong(tile, target);
  return true;
}
function onTileDown(e, tile) {
  if (!e.isPrimary) return;
  const clickingHeld = held === tile;
  if (held && !clickingHeld) { held.el.classList.remove("held", "dragging"); held = null; }
  const p = toStage(e);
  drag = { tile, pointerId: e.pointerId, dx: p.x - parseFloat(tile.el.style.left), dy: p.y - parseFloat(tile.el.style.top), startX: p.x, startY: p.y, moved: false, wasHeld: clickingHeld };
  try { tile.el.setPointerCapture(e.pointerId); } catch (_) {}
  tile.el.classList.add("dragging");
}
function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const p = toStage(e);
  if (!drag.moved) {
    if (Math.hypot(p.x - drag.startX, p.y - drag.startY) < DRAG_THRESHOLD) return;
    drag.moved = true;
    if (held === drag.tile) held = null;
    drag.tile.el.classList.remove("held");
  }
  const w = drag.tile.el.offsetWidth, h = drag.tile.el.offsetHeight;
  const stageR = stage.getBoundingClientRect();
  drag.tile.el.style.left = Math.max(0, Math.min(p.x - drag.dx, stageR.width - w)) + "px";
  drag.tile.el.style.top = Math.max(0, Math.min(p.y - drag.dy, stageR.height - h)) + "px";
  const t = findTargetSlot(p.x, p.y);
  slots.forEach((s) => s.el.classList.toggle("hot", s === t));
}
function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const { tile, moved, wasHeld } = drag;
  drag = null;
  slots.forEach((s) => s.el.classList.remove("hot"));
  if (!moved) {
    if (wasHeld) { tile.el.classList.remove("held", "dragging"); held = null; return; }
    held = tile; tile.el.classList.add("held"); return;
  }
  tile.el.classList.remove("dragging", "held");
  if (!tryPlace(tile, findTargetSlot(toStage(e).x, toStage(e).y))) returnHome(tile);
}
function returnHome(tile) {
  tile.el.classList.add("returning");
  tile.el.style.left = tile.homeX + "px";
  tile.el.style.top = tile.homeY + "px";
  const done = () => tile.el.classList.remove("returning");
  tile.el.addEventListener("transitionend", done, { once: true });
  window.setTimeout(done, 620);
}
function onWrong(tile, slot) {
  score = Math.max(0, score - 5);
  slot.el.classList.remove("reject"); void slot.el.offsetWidth; slot.el.classList.add("reject");
  returnHome(tile);
}
document.addEventListener("pointermove", onPointerMove);
document.addEventListener("pointerup", onPointerUp);
document.addEventListener("pointercancel", onPointerUp);
```

```css
.tile { position: absolute; min-width: 96px; min-height: 38px; touch-action: none; cursor: pointer; z-index: 4; }
.tile.returning { transition: left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.tile.dragging { z-index: 8; cursor: grabbing; }
.slot.hot { outline: 3px solid var(--accent); }
.slot.reject { animation: slot-reject 420ms ease; }
@keyframes slot-reject { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
@media (prefers-reduced-motion: reduce) {
  .tile.returning { transition: none; }
  .slot.reject { animation: none; }
}
```

## Card flip

3D match/miss board. Cards are `<button>`. **Do not** put `filter` on `.card-inner` — it breaks `preserve-3d`. Not for HUD-only games.

```html
<button class="card" type="button" aria-label="Hidden card">
  <span class="card-inner">
    <span class="card-face card-back" aria-hidden="false">?</span>
    <span class="card-face card-front" aria-hidden="true"></span>
  </span>
</button>
```

```css
.board { perspective: 1100px; }
.card { position: relative; width: var(--card-size, 120px); height: var(--card-size, 120px); padding: 0; border: 0; background: transparent; cursor: pointer; }
.card-inner {
  position: absolute; inset: 0; transform-style: preserve-3d; -webkit-transform-style: preserve-3d;
  transition: transform 460ms cubic-bezier(0.2, 0.78, 0.25, 1.18); border-radius: inherit;
}
.card.flipped .card-inner, .card.matched .card-inner { transform: rotateY(180deg); }
.card-face { position: absolute; inset: 0; display: grid; place-items: center; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: inherit; }
.card-back { transform: rotateY(0deg) translateZ(1px); background: var(--accent); color: #fff; }
.card-front { transform: rotateY(180deg) translateZ(1px); background: hsl(var(--pair-hue, 290), 100%, 96%); }
@media (prefers-reduced-motion: reduce) { .card-inner { transition-duration: 1ms; } }
```

```js
function flipCard(index) {
  if (state.phase !== "playing" || state.flipped.length >= 2) return;
  const card = state.cards[index];
  if (!card || card.matched || card.el.classList.contains("flipped")) return;
  card.el.classList.add("flipped");
  state.flipped.push(index);
  if (state.flipped.length < 2) return;
  state.phase = "resolving";
  const [a, b] = state.flipped;
  const match = state.cards[a].pairId === state.cards[b].pairId;
  window.setTimeout(match ? resolveMatch : resolveMiss, match ? 400 : 820);
}
function resolveMatch() {
  state.flipped.forEach((i) => { state.cards[i].matched = true; state.cards[i].el.classList.add("matched"); state.cards[i].el.disabled = true; });
  state.flipped = []; state.phase = "playing";
}
function resolveMiss() {
  state.flipped.forEach((i) => state.cards[i].el.classList.remove("flipped"));
  state.flipped = []; state.phase = "playing";
}
```

## Tap world

Platforms *are* the answers. Hazard is the timer. One kit: `direction: "up" | "down"` (sign flips, not two engines). Pair with **Per-number ranks** when each factor has its own letter.

- `up`: hazard rises, camera ~62% down the screen, fail when feet meet hazard.
- `down`: hazard falls, camera ~38%, fail when hazard meets head.

```js
const DIRECTION = "up";
const TARGET_STEPS = 12;
const RANK_SPEED = { C: 1, B: 1.35, A: 1.75, S: 2.25 };
const PLAYER_H = 72;
const CAM_BIAS = DIRECTION === "up" ? 0.62 : 0.38;

function correctForRow(rowIdx) {
  return skipBy * (DIRECTION === "up" ? rowIdx : TARGET_STEPS - rowIdx);
}
function spawnRows() {
  const sign = DIRECTION === "up" ? -1 : 1;
  const baseY = DIRECTION === "up" ? stageH - 130 : 130;
  rows = [];
  for (let i = 1; i <= TARGET_STEPS; i++) {
    const y = baseY + sign * i * rowGap;
    const plats = makeOptions(i).map((num) => {
      const el = document.createElement("div");
      el.className = "platform dormant";
      el.innerHTML = '<span class="num">?</span>';
      const plat = { num, correct: num === correctForRow(i), el, dead: false, y };
      el.addEventListener("click", () => onPlatformTap(i, plat));
      return plat;
    });
    rows.push({ y, plats });
  }
}
function onPlatformTap(rowIdx, plat) {
  if (!playing || jumping || rowIdx !== step + 1 || plat.dead) return;
  if (plat.correct) { combo += 1; leapTo(rowIdx, plat); }
  else {
    plat.dead = true;
    combo = 0;
    score = Math.max(0, score - 5);
    hazardY += DIRECTION === "up" ? -70 : 70;
  }
}
function updateCamera(instant) {
  const targetCam = playerY + PLAYER_H - stageH * CAM_BIAS;
  cameraY = instant ? targetCam : cameraY + (targetCam - cameraY) * 0.12;
  world.style.transform = `translate3d(0, ${-cameraY}px, 0)`;
}
function tick(ts) {
  if (!playing) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  hazardY += (DIRECTION === "up" ? -1 : 1) * (30 + step * 2.5) * (RANK_SPEED[rank] || 1) * (stageH / 700) * dt;
  updateCamera(false);
  const caught = DIRECTION === "up" ? playerY + PLAYER_H - 6 >= hazardY : hazardY >= playerY + 6;
  if (caught) { finishGame(false); return; }
  requestAnimationFrame(tick);
}
async function finishGame(won) {
  playing = false;
  if (won) {
    const nr = nextRank(rank);
    if (nr !== rank) { ranksBySkip[String(skipBy)] = nr; rank = nr; }
  } else if (rank === "S" && step < 4) {
    ranksBySkip[String(skipBy)] = "A"; rank = "A";
  }
  await persistSession({
    rank, score,
    extra: { ranks: ranksBySkip, lastSkipBy: skipBy, lastScore: score, won, lastStep: step }
  });
}
```

## Per-number ranks

Nine letters for keys `"2"`…`"10"`. Catalog `rankMode: "perNumber"`. **Write `stats.ranks`**. `difficultyLevel` is the **current** number’s 1–4, not the lobby average.

```js
function defaultRanks() {
  const o = {};
  for (let n = 2; n <= 10; n++) o[String(n)] = "C";
  return o;
}
function parseRanks(stats) {
  const base = defaultRanks();
  if (!stats || typeof stats !== "object") return base;
  const src = stats.ranks && typeof stats.ranks === "object" ? stats.ranks : stats;
  for (let n = 2; n <= 10; n++) {
    const key = String(n);
    if (RANKS.includes(src[key])) base[key] = src[key];
  }
  return base;
}
function renderPicker(ranksBySkip) {
  const grid = document.createElement("div");
  grid.className = "pick-grid";
  for (let n = 2; n <= 10; n++) {
    const r = ranksBySkip[String(n)] || "C";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `×${n} <span class="rank-badge rank-${r}">${r}</span>`;
    btn.addEventListener("click", () => beginRound(n));
    grid.appendChild(btn);
  }
  overlayExtraEl.replaceChildren(grid);
}
```

```css
.pick-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.55rem; margin: 0.75rem auto; max-width: 22rem; }
.pick-grid button { min-height: 3.2rem; border-radius: 12px; font-family: var(--font-display); font-weight: 700; cursor: pointer; }
```

## Canvas wire

Elastic tip, magnetic snap, decoys. Overlay chrome still from **Overlay** above. A/S may add **Timer curtain** per circuit.

```js
const SNAP_PAD = { C: 62, B: 42, A: 28, S: 18 };
const stiff = 180, damp = 16;
const tip = { x: 0, y: 0, vx: 0, vy: 0 };
let sag = 40, sagV = 0, snapped = null;
const pointer = { x: 0, y: 0 };

function toLocal(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
canvas.addEventListener("pointermove", (e) => { const p = toLocal(e); pointer.x = p.x; pointer.y = p.y; });
canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); const p = toLocal(e); pointer.x = p.x; pointer.y = p.y; });
canvas.addEventListener("pointerup", () => { if (snapped) commitNode(snapped); });

function updateWire(dt) {
  let tx = pointer.x, ty = pointer.y;
  let nearest = null, nd = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(tip.x - n.x, tip.y - n.y);
    if (d < nd) { nd = d; nearest = n; }
  }
  const snapRange = nearest ? nearest.r + (SNAP_PAD[rank] || 42) : 0;
  snapped = nearest && nd < snapRange ? nearest : null;
  if (snapped) {
    const pull = 1 - Math.min(1, nd / snapRange);
    tx = pointer.x + (snapped.x - pointer.x) * (0.45 + pull * 0.5);
    ty = pointer.y + (snapped.y - pointer.y) * (0.45 + pull * 0.5);
  }
  tip.vx += (tx - tip.x) * stiff * dt;
  tip.vy += (ty - tip.y) * stiff * dt;
  tip.vx *= Math.exp(-damp * dt);
  tip.vy *= Math.exp(-damp * dt);
  tip.x += tip.vx * dt;
  tip.y += tip.vy * dt;
  const span = Math.hypot(anchor.x - tip.x, anchor.y - tip.y);
  const restSag = Math.min(130, Math.max(12, span * 0.22));
  sagV += (restSag - sag) * 90 * dt;
  sagV *= Math.exp(-10 * dt);
  sag += sagV * dt;
}
function commitNode(node) {
  if (node.isAnswer) { spawnSparks(node.x, node.y, { color: "#7cf7ff" }); examplePatch("ok"); }
  else {
    spawnSparks(node.x, node.y, { color: "#ff5a6a" }); examplePatch("bad");
    const a = Math.atan2(pointer.y - node.y, pointer.x - node.x);
    tip.vx += Math.cos(a) * 900; tip.vy += Math.sin(a) * 900 - 250;
  }
}
```

## Graph pick

Answers live on **graph neighbors**, not a free-floating quiz. Wrong pick is retryable (typically −5). Stage atmosphere (starfield, etc.) is not a second overlay.

```js
const DISTRACTORS = { C: 2, B: 2, A: 3, S: 3 };
function presentProblem() {
  const cur = walk[stepIndex];
  const next = walk[stepIndex + 1];
  const prob = problems[stepIndex];
  clearChoiceUi();
  nodeEls[cur].classList.add("current");
  const neighbors = [...adj[cur]];
  const others = shuffle(neighbors.filter((n) => n !== next));
  const maxD = Math.min(DISTRACTORS[rank] || 2, others.length);
  const shown = shuffle([next, ...others.slice(0, maxD)]);
  const decoys = makeDistractors(prob.correct, maxD);
  let d = 0;
  shown.forEach((nb) => {
    const value = nb === next ? prob.correct : decoys[d++];
    const el = nodeEls[nb];
    el.classList.add("selectable");
    const chip = document.createElement("div");
    chip.className = "answer-chip";
    chip.textContent = value;
    el.appendChild(chip);
  });
  promptEl.textContent = prob.prompt;
}
function onNodeClick(i) {
  if (state !== "choosing") return;
  const cur = walk[stepIndex];
  if (!adj[cur].has(i) || !nodeEls[i].classList.contains("selectable")) return;
  if (i === walk[stepIndex + 1]) { /* travel juice, then next step */ }
  else score = Math.max(0, score - 5);
}
```

## Memorize-then-hunt

Study targets → lights-out grid with a moving flashlight (`--mx` / `--my`). Keep a collapsible reminder. Keyboard focus should move the beam onto the focused cell. Do not merge into flip or drag.

```js
function setBeamPosition(xPercent, yPercent) {
  stage.style.setProperty("--mx", Math.max(0, Math.min(100, xPercent)) + "%");
  stage.style.setProperty("--my", Math.max(0, Math.min(100, yPercent)) + "%");
}
function queueBeamAt(clientX, clientY) {
  queuedPointer = { clientX, clientY };
  if (pointerFrame) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    if (!queuedPointer || phase !== "hunting") return;
    const rect = stage.getBoundingClientRect();
    setBeamPosition(((queuedPointer.clientX - rect.left) / rect.width) * 100, ((queuedPointer.clientY - rect.top) / rect.height) * 100);
    queuedPointer = null;
  });
}
function beginHunt() {
  phase = "hunting";
  stage.classList.add("hunting");
  memoryCard.hidden = true;
  reminder.hidden = false;
}
stage.addEventListener("pointermove", (e) => { if (phase === "hunting") queueBeamAt(e.clientX, e.clientY); });
```

```css
.hunt-stage { position: relative; --mx: 50%; --my: 50%; }
.darkness {
  position: absolute; inset: 0; z-index: 5; pointer-events: none; opacity: 0;
  background: radial-gradient(circle 140px at var(--mx) var(--my), transparent 0 28%, rgba(1, 3, 10, 0.72) 70%, rgba(1, 3, 10, 0.96) 100%);
}
.hunt-stage.hunting .darkness { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .darkness { background: rgba(1, 3, 10, 0.35); } }
```

## Hand + slots

Deck → hand of 3 → play into blanks. Drag details live in **Pointer drag**; this is the loop. A/S may include distractor slots no card can solve. S may use the timer **bar** variant (120s, pause on tab hide), not a falling curtain.

```js
const HAND_SIZE = 3, SLOT_COUNT = 3, PROBLEMS_PER_ROUND = 12, ROUNDS_TO_PROMOTE = 3;
function dealHand() {
  while (state.hand.length < HAND_SIZE && state.deck.length) state.hand.push(state.deck.pop());
  renderHand();
}
function playCardOnSlot(handIndex, slotIndex) {
  const value = state.hand[handIndex];
  const slot = slots[slotIndex];
  if (value == null || !slot) return;
  if (slot.kind === "distractor") return; // unsolvable on purpose
  if (value === slot.need) {
    state.hand[handIndex] = null;
    slot.filled = true;
    state.solved += 1;
    dealHand();
    if (state.solved >= PROBLEMS_PER_ROUND) finishRound(true);
  }
}
function finishRound(won) {
  if (won) {
    state.roundsAtRank += 1;
    if (state.roundsAtRank >= ROUNDS_TO_PROMOTE) { state.rank = nextRank(state.rank); state.roundsAtRank = 0; }
  } else if (state.rank === "S") {
    state.rank = "A"; state.roundsAtRank = 0;
  }
  persistSession({
    rank: state.rank, score: state.sessionScore,
    extra: { roundsAtRank: state.roundsAtRank, won, lastRoundScore: state.roundScore, sessionScore: state.sessionScore }
  });
}
```

## Timer curtain

Cover grows down from the top: `height = elapsedFrac * 100%`. Warn ≤33%, critical ≤15%. Pair with a numeric chip. C/B ranks may omit a timer.

**Bar variant (not a curtain):** depleting bar + `m:ss`, pause remaining ms on `visibilitychange`.

```css
#timer-curtain {
  position: absolute; left: 0; right: 0; top: 0; height: 0%; z-index: 1; pointer-events: none; opacity: 0;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent-hot) 34%, transparent), transparent);
}
#timer-curtain.visible { opacity: 1; }
#timer-curtain.warn { background: linear-gradient(180deg, rgba(251, 146, 60, 0.42), transparent); }
#timer-curtain.critical { background: linear-gradient(180deg, rgba(255, 84, 104, 0.5), transparent); }
```

```js
function updateTimerVisuals() {
  const fracLeft = roundSeconds > 0 ? timeLeft / roundSeconds : 0;
  timerCurtain.style.height = Math.min(100, Math.max(0, (1 - fracLeft) * 100)) + "%";
  timerCurtain.classList.toggle("warn", fracLeft <= 0.33 && fracLeft > 0.15);
  timerCurtain.classList.toggle("critical", fracLeft <= 0.15);
  timerEl.textContent = String(Math.max(0, Math.ceil(timeLeft)));
}
function tickTimer(now) {
  if (mode !== "playing") return;
  timeLeft = Math.max(0, roundSeconds - (now - timerStart) / 1000);
  updateTimerVisuals();
  if (timeLeft <= 0) { failOnTimeout(); return; }
  timerRaf = requestAnimationFrame(tickTimer);
}
function startTimer(seconds) {
  roundSeconds = seconds; timeLeft = seconds; timerStart = performance.now();
  timerCurtain.classList.add("visible");
  timerRaf = requestAnimationFrame(tickTimer);
}
```

## Canvas juice

Additive sparks for canvas games. Skip spawn when `reducedMotion`.

```js
const particles = [];
function spawnSparks(x, y, opts) {
  if (reducedMotion) return;
  const o = Object.assign({ count: 14, speed: 260, spread: Math.PI * 2, angle: 0, color: "#7cf7ff", gravity: 420, size: 2.4, life: 0.55 }, opts || {});
  for (let i = 0; i < o.count; i++) {
    const a = o.angle + (Math.random() - 0.5) * o.spread;
    const sp = o.speed * (0.35 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: o.life, maxLife: o.life, size: o.size, color: o.color, gravity: o.gravity });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.vx *= Math.pow(0.06, dt);
    p.vy *= Math.pow(0.2, dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
function drawParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke();
  }
  ctx.restore();
}
```

## Bonus runner

Not a math shell. `rankMode: "none"`. No `stats.rank`. Score = survival. Persist `{ bestScore, lastScore, runs }` at `difficultyLevel: 1`. Catalog `bonus: true`. Stub unlock as `true`; integrate wires the daily-bonus gate (lobby **and** in-page).

```js
const RANK_MODE = "none";
async function finishRun() {
  if (score > bestScore) bestScore = score;
  await onScore(score);
  await onSessionSave({ difficultyLevel: 1, stats: { bestScore, lastScore: score, runs: runsToday } });
}
function wantJump(e) { return e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW"; }
function wantDuck(e) { return e.code === "ArrowDown" || e.code === "KeyS"; }
async function checkUnlock() { return true; }
```

## Session length

Not a paste kit. Pick **one** gate; persist a completed **fail**, not only rank-up.

| Model | Rank up when | Fail / demote |
|---|---|---|
| 3-round run | Clear all 3 in one sitting | S fail on round 0 → A |
| N solves × 3 rounds | `roundsAtRank` hits 3 (can span sessions) | S timeout → A |
| N correct circuits | Hit the circuit target | S with very few correct → A |
| Clear max board | Only at max size | No demote |
| Mission / hunt | Complete the path or find all targets | Usually no demote |
| Escape N steps | Reach the end for that number | S + early fail → A |
| Survive | n/a (`rankMode: "none"`) | n/a |
