# Per-title audit (distillation metadata)

Not part of the skunkworks create-agent library. Keep this in MathArcade so a future distillation refresh can see what won. Do **not** copy this file into a standalone skunkworks workspace.

Evidence from reading every shipped catalog game (`wwwroot/js/common.js` → `GAMES`). What won, what to ignore, distinctive juice.

---

## `make10` — Make 10

**Better than the others:** Canvas elastic wire with magnetic snap, decoy nodes, A/S per-circuit timer curtain, and the **only** `keepalive` pagehide flush (progress **before** score so daily bonus still stamps if score sync fails). Canvas additive sparks.

**Paths:** `wwwroot/games/make10.html`, `wwwroot/js/make10.js`

**Do not copy:** Overlay/HUD as the chrome winner (flat overlay, no card, chip-dense HUD). Electric lab theme. Make-10 arithmetic. Local `matharcade_make10_best` as a substitute for server progress.

**Session:** 10 correct circuits → rank up. Soft demote S→A if `correctCount < 3`. C/B no timer; A 8s; S 5s per circuit.

**Persist:** `{ rank, correctCount, lastScore, bestScore }` · `rankMode: "single"`

---

## `skipcounting` — Lava Leap

**Better than the others:** Hazard-as-timer platform jumper: platforms *are* the answers, camera follow, combo, pose SVG, per-number ranks ×2–×10. Gold **S** rank skin.

**Paths:** `wwwroot/games/skipcounting.html`, `wwwroot/js/skipcounting.js`

**Do not copy:** A second jumper kit. Merge with Avalanche. Lava gold S hex must not be treated as the global S color.

**Session:** Reach ×12 to escape. Win → `nextRank` on that number. Soft demote S→A only if fail with `step < 4`.

**Persist:** `{ ranks: {"2":"C",…}, lastSkipBy, lastScore, won, lastStep }` · `rankMode: "perNumber"` · `difficultyLevel` = current number’s letter index+1

---

## `avalanche` — Avalanche Run

**Better than the others:** Same kit as Lava Leap with **down** camera/hazard and **ice S** rank colors — proof that rank skins must be CSS variables on the page.

**Paths:** `wwwroot/games/avalanche.html`, `wwwroot/js/avalanche.js`

**Do not copy:** A 2,000-line clone as a second pattern. Don’t copy lava gold S into ice.

**Diff vs lava (sign flips, not a new engine):** sequence `n×12 → 0`; rows spawn downward; hazard descends; camera bias 38% vs 62%; crumble→shatter; meter hot→cold.

---

## `maze` — Galaxy Maze

**Better than the others:** Neighbor multiple-choice on a graph. Travel (`flyShip` + trail) then scan-for-life juice. Factor max and distractor count by rank.

**Paths:** `wwwroot/games/maze.html`, `wwwroot/js/maze.js`

**Do not copy:** Starfield as a second overlay system (it is stage atmosphere). No sound toggle. Overlay has no kicker.

**Session:** One mission (10–15 jumps) → rank up until S. Wrong pick −5, retryable.

**Persist:** `{ rank, lastWon, jumps }` · `rankMode: "single"`

---

## `calendar` — Calendar Scramble

**Better than the others:** Pointer drag **and** click-to-place, wrong-slot bounce (−5), falling timer curtain, 3-round-run promote, S-fail demote only if fail on round 0, compact `.end-stats`. Rank persist exemplar.

**Paths:** `wwwroot/games/calendar.html`, `wwwroot/js/calendar.js`

**Do not copy:** Flat overlay (no `.overlay-card`). Dark gold chrome as the default library shell. Ordinal-month identity (`slot.idx === monthIdx`). No mute, no pagehide persist. Audio uses short option names and no `masterGain`.

**Session:** Clear 3 rounds in one run → one `nextRank`. S fail on first round → A.

**Persist:** `{ rank, lastScore, bestScore, monthsPlaced, mistakes, won }` · `rankMode: "single"`

---

## `primesearch` — Prime Search

**Better than the others:** Study three targets → lights-out hunt with a moving flashlight beam (`--mx/--my`), collapsible mission reminder, board growth by rank. Overlay kicker present. Has a sound toggle (but key is `MUTE_KEY`, not `SOUND_KEY`).

**Paths:** `wwwroot/games/primesearch.html`, `wwwroot/js/primesearch.js`

**Do not copy:** Force this loop into card-flip or drag. `MUTE_KEY` naming. “Any prime on the board” intuition — field is **three memorized targets + composites**.

**Session:** Find all three → rank up. Score decays with hunt time.

**Persist:** `{ rank, targets, found }` · `rankMode: "single"`

---

## `memorymatch` — Memory Match Math

**Better than the others:** **Best chrome** — glass topbar, labeled HUD chips, dialog overlay (kicker/title/copy/extra/stats/CTA), sound toggle, dual-bus Web Audio, DOM particles + confetti + ribbon, dual CSS+JS reduced-motion, keyboard 3D cards, live region.

**Paths:** `wwwroot/games/memorymatch.html`, `wwwroot/js/memorymatch.js`

**Do not copy:** Flip-card CSS onto every HUD. Candy purple theme as a required palette. Rank-up-only-at-24-cards as a global gate. `RANK_FLAVOR` / `RANK_SCALE`. No board shake (don’t invent one). `.end-stats` CSS is mostly unused here (overlay uses `.overlay-stats`).

**Session:** Rounds grow 8→24 cards; rank up only when clearing a 24-card board. Round restarts at 1 each session; rank persists.

**Persist:** `{ rank, round, cardCount, pairCount, attempts, seconds, family, roundScore, sessionScore }` · `rankMode: "single"` · no pagehide persist (only `stopMusic`)

---

## `feedthecats` — Feed the Cats

**Better than the others:** Hand/deck/slots, drag **and** select-then-click, inline SVG instance recolor (unique ids + CSS vars + `data-expression`), distractor “unsolvable” slots at A/S, 12×3 promote with round pips, S 120s depleting bar, `rank-down-banner`, pause timer on tab hide.

**Paths:** `wwwroot/games/feedthecats.html`, `wwwroot/js/feedthecats.js`, `svg-assets/cat.svg` (source art)

**Do not copy:** The whole café (3,600-line JS, 200-line cat SVG body, fish meter, gallery, meows). Chrome is a Memory Match fork — prefer Memory Match as canonical.

**Session:** 12 solves = round; 3 rounds at rank → promote. Any S timeout → demote to A (`roundsAtRank = 0`).

**Persist:** `{ rank, roundsAtRank, won, lastRoundScore, sessionScore, rankedUp }` · `rankMode: "single"`

---

## `bonus` — Dino Dash

**Better than the others:** Endless runner juice (jump/duck, parallax, hitstop, milestones). `rankMode: "none"` persist. Score = survival.

**Paths:** `wwwroot/games/bonus.html`, `wwwroot/js/bonus.js`

**Do not copy:** As a math-game shell. Unlock is **not** lobby-only — `checkGate()` uses `getDailyBonusUnlockStatus` before Start (fail-open on load error). No C/B/A/S UI.

**Persist:** `{ bestScore, lastScore, runs }` · `difficultyLevel: 1` · never `stats.rank`
