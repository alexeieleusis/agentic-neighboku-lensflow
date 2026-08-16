# Phase 20 — Release polish

## Scope (files this phase may create/modify)
- public/favicon.svg
- index.html
- README.md
- src/components/HelpPanel/*
- src/**
- public/**

## Requirements

### 5.1 Shell and theming (favicon sentence)

- Favicon is a rendering of the first game piece (not the default Vite icon).

### 9. Out of scope

No backend/server, accounts, multiplayer, leaderboards, scoring history, monetization,
analytics, or internationalization beyond the two hardcoded tutorial-video links. No CI
pipeline existed in the original (`.github/` is empty) — adding one is an optional
Phase 0 decision (see the implementation plan), not a functional requirement of the game
itself.

### Scope note (this phase, not from requirements.md)

The final `src/**`/`public/**` scope entries above are for a genuinely final polish
sweep only — fixing typos, removing dead code/leftover placeholder or debug UI,
tightening inconsistent copy, and wiring the favicon/description work described below.
This is NOT a license for large structural rework, refactors, or feature changes in
this phase; anything beyond small, local, final-polish edits is out of scope here. A
separate, broader `vibe-heal cleanup` sweep across the whole repo happens post-track
per implementation-plan.md §7 and is not this phase's job — this phase's own sweep is
scoped to whatever this phase's diff touches, not the whole project's history.

## Acceptance criteria
- The browser tab favicon is a rendering of the actual first game piece (the same piece rendering used on the board/tray), not the default Vite icon and not a generic/placeholder graphic.
- The favicon is wired up via a reference in `index.html` and resolves correctly in both `pnpm dev` and a `pnpm build`/`pnpm preview` production build.
- An in-app or README description equivalent to the original's `src/neighboku.md` in-app documentation exists at an explicit, named location (e.g. `README.md` and/or a Help-panel doc component) and accurately describes the game, its controls, and its hints.
- A final cleanup sweep was performed that addresses only genuine polish (typos, dead code, leftover placeholder/debug UI, consistent copy) — no large structural rework, refactor, or new feature was introduced under this phase's scope.
- `requirements.md` §9's out-of-scope list was not silently expanded by this phase's diff: no backend/server, accounts, multiplayer, leaderboards, scoring history, monetization, analytics, internationalization beyond the two hardcoded tutorial-video links, or CI pipeline was added by this phase.
- A full playthrough works cleanly at a board size below 8 (e.g. 6×6) and a board size at or above 8 (e.g. 9×9), in both Shapes and Faces piece-type modes, with no leftover placeholder/debug UI and no console errors or warnings.
- The app builds, lints, and tests cleanly (`pnpm build`, `pnpm lint`, `pnpm test`).

## Manual test checklist
- Run `pnpm dev` and open the app in a browser; confirm the browser tab favicon shows a rendering of the first game piece, not the default Vite logo.
- Run `pnpm build` then `pnpm preview`; confirm the built favicon also resolves correctly (not just in dev).
- Set Piece Type to Shapes; start a new game at a board size below 8 (e.g. 6×6) and play a full game through to the finished dialog, confirming no console errors or warnings appear at any point.
- Start a new game at a board size at or above 8 (e.g. 9×9) in Shapes mode and play a full game through to the finished dialog, confirming the dimension rule (§4.1) is still respected and no console errors or warnings appear.
- Repeat both board-size playthroughs (one <8, one >=8) with Piece Type set to Faces, confirming no console errors or warnings appear.
- Confirm no leftover placeholder or debug UI (e.g. "TODO" labels, lorem ipsum, stray test buttons, console.log noise) is visible anywhere in the flow.
- Read the README and/or in-app description and confirm it accurately describes the game, its controls, and its hints.
- Confirm no scope creep into anything listed in requirements.md §9: no accounts, backend, multiplayer, leaderboards, scoring history, monetization, analytics, internationalization beyond the two hardcoded tutorial links, or CI pipeline was added by this phase.

## Depends on
- Phase 19 merged.
