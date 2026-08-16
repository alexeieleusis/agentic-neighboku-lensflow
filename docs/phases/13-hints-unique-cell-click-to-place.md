# Phase 13 — Hints: unique-cell asterisk & click-to-place

## Scope (files this phase may create/modify)
- src/components/AvailablePiecesTray/AvailablePiecesTray.tsx
- src/components/AvailablePiecesTray/AvailablePiecesTray.types.ts
- src/components/AvailablePiecesTray/useAvailablePiecesTrayDomain.ts
- src/components/AvailablePiecesTray/useAvailablePiecesTrayState.ts
- src/components/AvailablePiecesTray/useAvailablePiecesTrayActions.ts
- src/components/AvailablePiecesTray/useAvailablePiecesTrayViewModel.ts
- src/components/AvailablePiecesTray/AvailablePiecesTray.stories.tsx
- src/components/AvailablePiecesTray/__tests__/*

## Requirements

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.5 (Available pieces tray), quoted verbatim in full (this phase implements the second bullet's `*` clause and the third bullet in full; the first and fourth bullets — column layout/sort and tray width — were already implemented in Phase 7 and are not re-scoped here):

> ### 5.5 Available pieces tray
>
> - One column per distinct remaining piece value, sorted ascending by the piece's
>   base-10-encoded value.
> - Each column shows: the draggable piece image, the remaining count, and — if
>   `hintAvailablePieceUniqueCell` is on **and** the count of legal fit-cells for that
>   piece equals its remaining count — an appended `*` (the "this piece's placement is
>   now forced" hint described in the video).
> - If `hintPieceCells` is on, each column also lists a button per legal fit-cell (labeled
>   with 1-indexed `row,column`) that places the piece there on click — this is the
>   keyboard/click-friendly alternative to drag-and-drop and must be preserved even though
>   it isn't mentioned in the tutorial video.
> - Tray width scales with board size (`56px × size`).

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.11 (Hints summary, cross-reference), the two relevant rows quoted verbatim from the full table:

| Hint | Preference | Behavior |
|---|---|---|
| Unique-cell asterisk | `hintAvailablePieceUniqueCell` | §5.5 |
| Click-to-place cell list | `hintPieceCells` | §5.5 |

## Acceptance criteria
- Each tray column appends a literal `*` to its displayed remaining count if and only if `hintAvailablePieceUniqueCell` is `true` and the count of that piece value's legal fit-cells (from `pieceToFitCells`) exactly equals its remaining tray count; the `*` is absent whenever either condition is false, and this comparison is a pure function in `useAvailablePiecesTrayDomain.ts`, not inline in the view-model or render layer.
- When `hintAvailablePieceUniqueCell` is `false`, no column ever renders a `*`, regardless of whether the unique-cell condition would otherwise hold.
- When `hintPieceCells` is `true`, each column renders exactly one button per legal fit-cell for that piece value (per the current `pieceToFitCells` cache), and each button's label is the 1-indexed `row,column` of that cell (e.g. cell `(0,0)` is labeled `1,1`), computed by a pure function in `useAvailablePiecesTrayDomain.ts`.
- When `hintPieceCells` is `false`, no column renders any click-to-place buttons.
- Clicking a click-to-place button invokes `placePiece` (from Phase 3's `game/gameBuilder.ts`) with that button's exact piece value and cell, the same placement function used by the existing drag-and-drop and click-to-place paths, and no parallel/duplicate placement logic is introduced in `AvailablePiecesTray`.
- The click-to-place action is implemented in `useAvailablePiecesTrayActions.ts` as an event-handler closure that curries a `useAvailablePiecesTrayDomain.ts` function with the current state/telescope and commits the result via `telescope.update`/`.evolve`; the action body itself contains no business logic beyond invoking the curried domain function and committing.
- `AvailablePiecesTray`'s file layout reflects the scale-rule re-evaluation required by this phase: because click-to-place is a genuine user action requiring a commit path, the component now has `useAvailablePiecesTrayDomain.ts` (pure functions: unique-cell comparison, fit-cell-to-label computation), `useAvailablePiecesTrayState.ts` (values derived from the magnified telescope's current state via the domain functions), `useAvailablePiecesTrayActions.ts` (the click-to-place handler), and `useAvailablePiecesTrayViewModel.ts` (the orchestrator composing the three, wiring only) — matching `docs/CONVENTIONS.md`'s non-trivial-component split.
- `AvailablePiecesTray` still follows the outer `state,telescope → useXViewModel → RenderX` fractal pattern (`docs/neighboku-ai-rebuild/requirements.md` §7.2), and any parent-to-child state flow introduced for the button list uses a magnified telescope, not prop-drilled callbacks.
- Any new state/types introduced for this component are `readonly`/`ReadonlyArray`/`ReadonlyMap`-typed at every level, and all updates are expressed as new objects via spread, never in-place mutation, including for `Map`s (`docs/neighboku-ai-rebuild/requirements.md` §7.3).
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with no errors.

## Manual test checklist
- Run `pnpm dev` and open the app in a browser.
- Play until some tray piece's remaining count equals its legal-fit-cell count (e.g. play until only one placement is possible for some piece), with `hintAvailablePieceUniqueCell` on, and confirm that piece's column shows the appended `*`.
- Toggle `hintAvailablePieceUniqueCell` off and confirm the `*` disappears from that same column with no other visible change.
- Toggle `hintPieceCells` on and confirm each tray column shows one button per legal fit-cell, each labeled with the 1-indexed `row,column` of that cell.
- Click one of those buttons and confirm the piece is placed at that exact cell, using the same placement path as drag-and-drop/click (board updates, tray count decrements, fit caches recompute).
- Toggle `hintPieceCells` off and confirm the click-to-place buttons disappear from every column.
- Confirm the browser devtools console shows no errors or warnings throughout.

## Depends on
- Phase 12 merged.
