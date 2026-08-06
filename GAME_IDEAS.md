# Math game ideas (brainstorm)

Scratch pad for concepts that are not ready to build yet. One-liners are fine; flesh out only when something feels worth shipping.

**Provenance:** Tag **`[AI]`** on ideas from assistant brainstorms; untagged entries are organic (yours).

**Shipped today:** Make 10, Galaxy Maze, Lava Leap, Avalanche Run, Prime Search, Memory Match Math, Calendar Scramble (see `wwwroot/js/common.js` → `GAMES`).

---

## Quick capture

Dump raw thoughts here; move to **Ideas** when you add a bit of structure.

- **`[AI]`** Coin counting: "exact change" checkout — pay the total with the fewest coins.
- **`[AI]`** Comparison: hungry croc chomps the bigger number (>, <, =).
- **`[AI]`** Place value: build a target number from tens/ones crates; hundreds as a later tier.

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

### Clock shop **`[AI]`**

- **Source:** AI-generated (assistant brainstorm, Aug 2026).
- **Math focus:** Reading/setting analog time — hour, half, quarter, then 5-minute marks; elapsed time as a stretch tier.
- **Hook / theme:** Run a clock-repair shop: customers bring in stopped clocks plus a digital time; set the hands correctly to fix them.
- **Core loop:** See a target time (digital or worded — "half past four"); drag the hour/minute hands on an analog face to match.
- **Win / progress:** Fix N clocks per shift; later shifts introduce quarter hours, 5-minute precision, then worded times.
- **Difficulty knobs:** hour-only → half → quarter → 5-min; set-the-clock vs read-the-clock (pick the matching digital); minute-hand snapping on/off.
- **Open questions:** Drag hands directly (fine motor) vs stepper buttons? Pair with Calendar Scramble as a "time literacy" family — shared art/characters?
- **Status:** promising

### Fraction feast **`[AI]`**

- **Source:** AI-generated (assistant brainstorm, Aug 2026).
- **Math focus:** Unit fractions and simple equivalents (1/2, 1/3, 2/4) as parts of a whole.
- **Hook / theme:** Pizza shop: customers order toppings on a fraction of the pie ("3/4 mushroom, please").
- **Core loop:** Drag toppings onto the right number of slices to match the ordered fraction; or pick which pie matches a shown fraction.
- **Win / progress:** Serve N orders correctly; later orders sneak in equivalents (2/4 vs 1/2).
- **Difficulty knobs:** denominators (2/4 → 3/6/8); picture→fraction vs fraction→picture; equivalents on/off.
- **Open questions:** Freeform topping placement (count what's covered) vs discrete per-slice tapping? How to hint equivalence without stating it?
- **Status:** seed

### Take-away tower **`[AI]`**

- **Source:** AI-generated (assistant brainstorm, Aug 2026).
- **Math focus:** Subtraction within 10 → 20; complements of landmark numbers.
- **Hook / theme:** Demolition crew: knock blocks off the tower until exactly the target number is left standing.
- **Core loop:** A tower of N blocks and an order ("leave 3 standing!"); tap blocks to demolish and watch 10 − x happen visually.
- **Win / progress:** Fill N orders per shift; towers grow past 10; over-demolishing cracks the foundation.
- **Difficulty knobs:** within 10 → within 20; show the equation alongside vs pure visual; timed vs relaxed.
- **Open questions:** Too close to Make 10's complements (10 − x vs x + ? = 10)? Distinct enough mechanic to earn a slot?
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
