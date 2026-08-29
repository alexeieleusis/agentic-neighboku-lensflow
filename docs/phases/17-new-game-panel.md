# Phase 17 — New Game panel & board size selection

## Scope (files this phase may create/modify)
- src/components/NewGamePanel/NewGamePanel.tsx
- src/components/NewGamePanel/NewGamePanel.types.ts
- src/components/NewGamePanel/useNewGamePanelDomain.ts
- src/components/NewGamePanel/useNewGamePanelState.ts
- src/components/NewGamePanel/useNewGamePanelActions.ts
- src/components/NewGamePanel/useNewGamePanelViewModel.ts
- src/components/NewGamePanel/__tests__/*.ts
- src/components/NewGamePanel/__tests__/*.tsx

## Requirements

### 4.1 Selectable board sizes

The New Game panel offers exactly these sizes: **4×4, 6×6, 8×8, 9×9, 12×12**.
On first open, the Board Size select defaults to **8×8**.
Selecting a size updates `dimension`: for `size < 8` the dimension is left unchanged
(whatever it currently is); if no prior value exists, the default `dimension` is `2`.
For `size >= 8` it is forced to `3`. `base` is not changed
by the size selector at all in the observed code path — carry this exact rule forward
even though it looks asymmetric; it is what the original does.

### 5.9 New Game panel

Bottom drawer, opened via a "new" icon. A single Board Size select (options in §4.1) and
a Start button. Starting a new game rebuilds the board from current preferences,
unfolds a fresh puzzle, resets `gamePlay.startTime`, and closes the panel.

## Acceptance criteria
- The Board Size select offers exactly the 5 documented sizes — 4×4, 6×6, 8×8, 9×9, 12×12 — no more and no fewer.
- Starting a new game rebuilds the board using Phase 2's `boardBuilder` and unfolds a fresh puzzle using Phase 3's `unfoldGame`.
- The size→dimension rule is implemented exactly as specified and is asymmetric by design: for `size < 8`, `dimension` is left unchanged from its current value (defaulting to `2` when no prior value exists); for `size >= 8`, `dimension` is forced to `3`.
- `base` is never modified by the size selector, regardless of which size is chosen.
- `gamePlay.startTime` is reset when Start is clicked.
- The New Game drawer closes after Start is clicked.
- `NewGamePanel` follows the fractal pattern (`state,telescope → useNewGamePanelViewModel → RenderNewGamePanel`) with parent→child state flow via a magnified telescope, and its file layout follows CONVENTIONS.md's scale rule for a non-trivial component: `NewGamePanel.tsx`, `NewGamePanel.types.ts`, and the split `useNewGamePanelDomain.ts` / `useNewGamePanelState.ts` / `useNewGamePanelActions.ts` / `useNewGamePanelViewModel.ts` hooks.
- The app builds, lints, and tests cleanly (`pnpm build`, `pnpm lint`, `pnpm test`).

## Manual test checklist
- Run `pnpm dev` and open the app in a browser.
- Open the New Game drawer via the "new" icon.
- For each of the 5 board sizes (4×4, 6×6, 8×8, 9×9, 12×12) in turn: select it, click Start, and confirm a correctly-sized board is generated.
- Confirm the dimension rule holds for sizes < 8 (4×4, 6×6): `dimension` remains unchanged from whatever it was before the selection.
- Confirm the dimension rule holds for sizes >= 8 (8×8, 9×9, 12×12): `dimension` is forced to `3`.
- Verify the dimension rule visually by checking piece rendering has 2 visual attributes (form + border color) when dimension is 2 and 3 visual attributes (form + border color + fill color) when dimension is 3.
- Confirm `base` never changes regardless of which size is selected, by comparing the set of distinct piece values available before and after each Start.
- Confirm the New Game drawer closes after clicking Start.
- Confirm the elapsed-time origin (`gamePlay.startTime`) resets after clicking Start, by checking the elapsed-time shown at game-finish reflects time since the most recent Start, not an earlier session.
- Confirm no console errors appear during any of the above steps.

## Depends on
- Phase 16 merged.
