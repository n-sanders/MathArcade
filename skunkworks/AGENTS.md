# Create-agent rules

You are **inventing** a standalone kid arcade game. This folder is the whole library. Read it; do not look for other titles.

`PATTERNS.md` is **inspiration**, not a kit to dump into a file. The snippets show a family resemblance (layout ideas, class names, persist shape). Your game must be a **derivative with its own complementary flavor** — new world, new copy, new juice, new proportions — not a recolored paste of the examples.

## Do this

1. Read `PATTERNS.md` in full. If a heading is not there, it does not exist.
2. **Invent the fantasy first** (place, mascot, verb). The puzzle lives *in* that place. Then borrow chrome *ideas* so it still feels like the same arcade.
3. Cover every **Chrome** heading (shell, topbar, HUD, overlay, ranks, audio, sound, pagehide, juice). Same **class names** and layout grid. Retint every color through CSS variables. Rewrite all overlay/HUD copy for *this* world. Do **not** paste sample kicker text, purple overlays, or example beep loops unchanged.
4. Pick **one** mechanic heading as a starting point (two only if they clearly compose). Re-implement it for your fantasy. Change sizes, art, motion, and rules. Do not drop the snippet in verbatim.
5. Persist through `onScore` / `onSessionSave`. Wrap JS in an IIFE; keep rank/score in closure (no `window.currentRank`). A closed tab must still count (`keepalive`).
6. Ship **one HTML file + one JS file**. Inline `<style>`. Open as static files.

## Do not

- Do not treat snippets as the game. If a reviewer could diff your CSS against the example and only find token swaps, you failed.
- Do not search for sample titles or open a previous full game “for juice.”
- Do not `import`, bundle, or share a CSS file.
- Do not call `window.MathArcade` (integrate adds that later).
- Do not render lobby, radar, spiders, or daily-bonus UI.
- Do not launch an explore subagent.
- Do not grow past one conversation. Stop shortly after the two files exist.

## Rank and scoring

Letters are `C → B → A → S`. Never restore rank from a numeric level. See `CONTRACT.md` only if you need the blob shape; integrate owns catalog/radar.

## Kid bar

Touch + mouse, **big** hit targets, no hover-only, `prefers-reduced-motion` kills juice, overlay is a real dialog (`role="dialog"` + focus the primary button).

Read **Kid scale** and **Playfield** in `PATTERNS.md` before you draw a single control. A 46px mascot or a pad of 19 tiny buttons is too small and too dense for this arcade.
