# Phase 10 — Undo

## Scope (files this phase may create/modify)
- src/components/UndoButton/UndoButton.tsx
- src/components/UndoButton/UndoButton.types.ts
- src/components/UndoButton/useUndoButtonViewModel.ts
- src/components/UndoButton/UndoButton.stories.tsx
- src/App.tsx

## Requirements

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §3.5 (Placing and undoing a move),
quoted verbatim (only the `undoPlay` bullet is relevant to this phase; `placePiece` is
Phase 3 scope and is not touched here):

> ### 3.5 Placing and undoing a move
>
> - `placePiece(pieceValue, cell, game)`: computes the piece's legality against the
>   *current* `pieceToFitCells` cache, decrements the tray count (removing the entry at
>   zero), writes the piece into the board, recomputes both fit caches, and appends a
>   `Move` (`{ pieceValue, cell, isValid }`) to `placedCells`.
>   - If `preferences.preventInvalidMoves` is `true` and the move is invalid, the function
>     **throws** rather than mutating state; the caller is responsible for catching this
>     and surfacing the invalid-move feedback (see §5.13). If the preference is `false`,
>     an invalid move is still recorded (with `isValid: false`) and applied to the board.
> - `undoPlay(game)`: pops the last `Move`, returns its piece to the tray, blanks its
>   cell, and recomputes both fit caches. Undoing with an empty `placedCells` is
>   unhandled in the original (see §8.4) — the rebuild should reproduce this rather than
>   add defensive handling, unless the phase reviewer explicitly flags it as worth fixing.

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.7 (Undo), quoted verbatim in full:

> ### 5.7 Undo
>
> - Icon button, disabled iff `placedCells` is empty.
> - Restores the piece to the tray and blanks the cell (§3.5); recomputes fit caches.

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §8.4 (`undoPlay` on an empty move
list), quoted verbatim:

> ### 8.4 `undoPlay` on an empty move list
>
> `undoPlay` indexes `placedCells[placedCells.length - 1]` without checking for emptiness;
> in the UI this is masked because the Undo button is disabled when `placedCells` is empty
> (§5.7), so the unsafe path is unreachable through normal play. Replicate the UI guard;
> don't add defensive handling inside `undoPlay` itself.

**Boundary this phase must implement (not part of the literal excerpts above):**
`undoPlay` itself (built in Phase 3, `game/gameBuilder.ts`) is unguarded by design — it
does not, and must not, check whether `placedCells` is empty. Per §8.4, the *only* thing
that makes calling it safe in practice is that the UI never lets the user trigger it when
`placedCells` is empty. This phase — `UndoButton` — is that guard. Disabling the button
whenever `placedCells` is empty is not an optional nicety here; it is the entire safety
mechanism for the unguarded `undoPlay` call path, and it belongs exclusively in this
component. Do not add a length check, early return, or thrown error inside `undoPlay`
itself to compensate — that would duplicate the guard in the wrong layer and contradict
§8.4's explicit instruction to replicate the original's unhandled-empty-list behavior at
the domain layer.

## Acceptance criteria
- `UndoButton` follows the `state,telescope → useXViewModel → RenderX` fractal pattern
  (`docs/fractal_component.md`, `requirements.md` §7.2), with parent→child state flow (if
  any) via a magnified telescope (`telescope.magnify(new Lens(get, set))`) — not
  prop-drilled callbacks.
- `UndoButton`'s file layout matches `docs/CONVENTIONS.md`'s trivial-leaf scale rule
  (§7.2.1, using `UndoButton` itself as the canonical example): `UndoButton.tsx`
  (component function + `RenderUndoButton`), `UndoButton.types.ts` (props type + view-model
  type only, no hook logic), and a single flat `useUndoButtonViewModel.ts` with no
  `useUndoButtonDomain.ts`/`useUndoButtonState.ts`/`useUndoButtonActions.ts` split — this
  component has no local UI state and no business rules complex enough to warrant one.
- The rendered button is disabled if and only if `placedCells` is empty; it is enabled
  whenever `placedCells` has at least one entry.
- Clicking the button while enabled calls `undoPlay` from Phase 3's `game/gameBuilder.ts`
  and correctly updates the board (the undone cell is blanked), the tray (the piece's
  count is restored), and both fit caches (`pieceToFitCells`, `cellToFitPieces`) are
  recomputed to reflect the reverted state.
- The UI-level disabled-when-empty check in `UndoButton` is the *only* empty-`placedCells`
  protection anywhere in the undo path — `undoPlay` itself in `game/gameBuilder.ts` is not
  modified by this phase to add a length check, early return, or thrown error for an empty
  `placedCells`. A reviewer should treat any such addition inside `undoPlay` as a boundary
  violation for this phase, not a defensive improvement.
- `UndoButton` is wired into `src/App.tsx`'s top bar in the Undo slot (per §5.1's observed
  top-bar order: drag-fit-hint icon, Preferences button, New Game button, **Undo button**,
  solvability icon, Help button), receiving whatever telescope/props it needs to read
  `placedCells` and invoke `undoPlay` against the current game state.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with this phase's changes.

## Manual test checklist
- Run `pnpm dev` and open the app.
- Confirm the Undo button is disabled when no pieces have been placed (fresh board load).
- Place a piece on the board and confirm the Undo button becomes enabled.
- Click Undo and confirm the placed cell blanks on the board and the piece's count
  returns to the tray.
- Place and undo repeatedly; confirm repeated undos eventually disable the button again
  once `placedCells` returns to empty (zero moves).
- Confirm no errors appear in the browser console throughout, including no crash from
  attempting to trigger undo while the button is disabled.

## Depends on
- Phase 9 merged.
