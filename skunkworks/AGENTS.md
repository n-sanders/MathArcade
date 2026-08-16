# Create-agent rules

You are inventing a **standalone kid arcade game**. This folder is the whole library. Read it; do not look for other titles.

## Do this

1. Read `PATTERNS.md` in full (one file). If a heading is not there, it does not exist.
2. Always ship the **Chrome** sections: page shell, topbar, HUD chips, overlay, rank CSS, rank JS, web audio, sound pref, pagehide persist, DOM juice.
3. Paste **one** mechanic section (two only if they clearly compose, e.g. pointer-drag + timer-curtain).
4. Theme with CSS variables (`--ink`, `--accent`, `--paper`, rank hues). Do not invent a second chrome system.
5. Persist through `onScore` / `onSessionSave`. A closed tab must still count as a session (`keepalive`).
6. Ship **one HTML file + one JS file**. Inline `<style>` in the HTML. Open as static files.

## Do not

- Do not search for sample titles or open a previous full game “for juice.”
- Do not `import`, bundle, or share a CSS file.
- Do not call `window.MathArcade` (integrate adds that later).
- Do not render lobby, radar, spiders, or daily-bonus UI.
- Do not launch an explore subagent.
- Do not grow past one conversation. Stop shortly after the two files exist.

## Rank and scoring

Letters are `C → B → A → S`. Never restore rank from a numeric level. See `CONTRACT.md` only if you need the blob shape; integrate owns catalog/radar.

## Kid bar

Touch + mouse, big hit targets, no hover-only, `prefers-reduced-motion` kills juice, overlay is a real dialog (`role="dialog"` + focus the primary button).
