# Phase 11 — Invalid-move feedback

## Scope (files this phase may create/modify)
- src/App.tsx
- src/App.types.ts
- src/useApp*.ts

## Requirements

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.12 (Invalid-move feedback), quoted verbatim in full:

> ### 5.12 Invalid-move feedback
>
> When `placePiece` throws (§3.5), show a `Snackbar` with an "Invalid move!" error alert, auto-hiding after 6 seconds or on manual close.

Context, `docs/neighboku-ai-rebuild/requirements.md` §3.5 (Placing and undoing a move), the throw-trigger sentence only, quoted verbatim, so the Snackbar trigger condition is unambiguous without a second file read:

> If `preferences.preventInvalidMoves` is `true` and the move is invalid, the function **throws** rather than mutating state; the caller is responsible for catching this and surfacing the invalid-move feedback (see §5.13). If the preference is `false`, an invalid move is still recorded (with `isValid: false`) and applied to the board.

(That excerpt's own cross-reference to "§5.13" is a numbering artifact in the source document — the actual invalid-move-feedback section is §5.12, quoted above; §5.13 in requirements.md is the solvability indicator, unrelated to this phase.)

**Boundary this phase must implement (not part of the literal excerpts above):** Phase 8 (drag-and-drop — desktop) already ensures the `placePiece` throw is caught somewhere in the drag-end handling path so an invalid drop doesn't crash the app, but Phase 8's acceptance criteria explicitly deferred the Snackbar UI feedback for that caught error to this phase. This phase is that UI: wherever `App`'s action handling catches a `placePiece` throw (whether from a drag-end drop or any other placement path already wired by earlier phases), it must now also trigger the Snackbar described in §5.12 above, through `App`'s existing `useAppViewModel` orchestration (Phase 4) — not through new local state that bypasses it.

## Acceptance criteria
- When `preferences.preventInvalidMoves` is `true` and a placement attempt is invalid, `placePiece` throwing is caught by `App`'s action-handling code and triggers the Snackbar to open — no attempt is made to catch this at a lower layer or to suppress the throw itself.
- The Snackbar, when open, displays an error-severity `Alert` (MUI `severity="error"`) containing the exact text "Invalid move!".
- The open Snackbar auto-hides after 6 seconds with no user interaction (`autoHideDuration={6000}` or equivalent).
- The open Snackbar can also be closed manually (e.g. via its close affordance) before the 6-second auto-hide elapses, and doing so closes it immediately.
- The Snackbar's open/closed state is driven through `App`'s `state,telescope → useAppViewModel → RenderApp` fractal orchestration established in Phase 4 — not through ad hoc local `useState` in `App.tsx`/`RenderApp` that bypasses the telescope/view-model flow, and not through a magnified telescope to a child component when the state is App-shell-owned.
- If new state is added for the Snackbar (e.g. an `invalidMoveSnackbarOpen` field on `AppState` in `App.types.ts`), it is typed consistently with the rest of `AppState`'s readonly discipline (`docs/neighboku-ai-rebuild/requirements.md` §7.3) and updates are expressed as new objects via spread, never in-place mutation.
- A valid placement (no throw) never opens the Snackbar.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with no errors.

## Manual test checklist
- Before starting `pnpm dev`, temporarily enable invalid moves for this manual test only, since the real Preferences-panel toggle for `preventInvalidMoves` doesn't ship until Phase 16: either edit the `preventInvalidMoves` default to `false` in the preferences source for the duration of this test (reverting the edit afterward), or load the app once, open devtools, and write `preventInvalidMoves: false` directly into the persisted preferences object in `localStorage` before reloading.
- Explicitly note that this `preventInvalidMoves` toggle-flip is a manual-testing-only workaround, not a Phase 11 deliverable, and that Phase 16's own manual test checklist will re-confirm this same Snackbar path once the real Preferences-panel toggle exists.
- Run `pnpm dev` and open the app in a browser with the workaround above in effect.
- Attempt an invalid move: place a piece somewhere that violates the neighbor rule (shares zero or more than one attribute with an orthogonal neighbor) or violates the row/column/section uniqueness constraint.
- Confirm the Snackbar appears immediately with an error-severity "Invalid move!" alert.
- Wait 6 seconds without interacting and confirm the Snackbar auto-hides on its own.
- Trigger another invalid move, then click the Snackbar's close affordance before 6 seconds elapse, and confirm it closes immediately on that manual close.
- Place a valid piece and confirm the Snackbar does not appear for a valid placement.
- Confirm the browser devtools console shows no errors throughout.
- Revert whichever `preventInvalidMoves` workaround was used (restore the default, or clear/reset the `localStorage` override) once the manual test is complete.

## Depends on
- Phase 10 merged.
