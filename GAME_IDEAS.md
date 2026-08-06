# Math game ideas (brainstorm)

Scratch pad for concepts that are not ready to build yet. One-liners are fine; flesh out only when something feels worth shipping.

**Shipped today:** Make 10, Galaxy Maze, Lava Leap, Avalanche Run, Prime Search, Memory Match Math, Calendar Scramble (see `wwwroot/js/common.js` → `GAMES`).

---

## Quick capture

Dump raw thoughts here; move to **Ideas** when you add a bit of structure.

---

## Ideas

### Days in a month

- **Math focus:** How many days each month has (28/29/30/31), leap year for February if we go there.
- **Hook / theme:** TBD — less thought so far.
- **Core loop:** TBD — likely pick or type day count for a given month (or match month ↔ count).
- **Win / progress:** TBD
- **Difficulty knobs:** TBD (all months vs random subset; Feb/leap as optional tier)
- **Open questions:** Standalone game, or a second mode of Calendar Scramble now that month sorting shipped on its own? Input style (multiple choice vs typing)?
- **Status:** seed

---

## Maybe later

Ideas that need more thought or depend on something else (art, new API, younger/older kid).

- 

---

## Not now (parked)

Good concept, wrong time — note why so future-you remembers.

- 

---

## Shipped from this list

Move titles here when they land in `GAMES` so the brainstorm stays honest.

- **Month sorting → Calendar Scramble** (`calendar` in `GAMES`). Shipped with the numbered ordinal stack (1st–12th), not the pie layout; drag-to-slot with wrong-slot bounce (−5 pts). Two rounds per stage, more months missing each stage up to a fully scrambled year.
