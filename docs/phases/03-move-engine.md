# Phase 03 — Puzzle unfolding & move engine

## Scope (files this phase may create/modify)
- src/game/gameBuilder.ts
- src/game/__tests__/*

## Requirements

This phase implements `unfoldGame`, `placePiece`, `undoPlay`, and the
`pieceToFitCells`/`cellToFitPieces` fit caches in `game/gameBuilder.ts`. The literal
requirements excerpts below are from `docs/neighboku-ai-rebuild/requirements.md`
§3.4, §3.5, and §3.6, plus the related known-discrepancy notes from §8.3, §8.4, and
§8.7 that this phase must reproduce rather than "fix."

### §3.4 Puzzle unfolding (`unfoldGame`)

Starting from a fully-solved board, cells are repeatedly blanked out to build the
playable puzzle:

- On each iteration, find all currently-filled "locked" cells: a filled cell is locked
  if none of the pieces *already removed* (available in the tray) could legally replace
  it — i.e. removing it wouldn't just recreate an already-known ambiguity — **and** it
  is not the sole remaining neighbor of any of its own neighbors (a cell whose removal
  would leave a neighbor with zero placed neighbors is never a candidate for removal, to
  avoid isolating cells).
- Among the locked cells, prefer removing the piece value with the **lowest** removal
  frequency so far when `size > 4`, and the **highest** frequency when `size <= 4`
  (deliberately different tie-breaking for small vs. larger boards — preserve as-is).
- Stop when no locked cells remain.
- **Rebuild note**: the four-tier "Easy/Medium/Hard/Expert" difficulty design described
  in a code comment is aspirational and **not implemented** in the original — only the
  single unparameterized strategy above exists. Replicate the single strategy; do not
  implement the commented-out difficulty tiers as if they were a requirement (see §8.3).
- After unfolding, two caches are (re)computed and must be kept in sync on every mutation:
  `pieceToFitCells` (tray piece value → cells it could legally go in) and
  `cellToFitPieces` (blank cell → pieces that could legally go there).

### §3.5 Placing and undoing a move

- `placePiece(pieceValue, cell, game)` executes the following steps in order:
  1. Compute the piece's legality against the *current* `pieceToFitCells` cache.
  2. If `preferences.preventInvalidMoves` is `true` and the move is invalid, **throw**
     immediately — no state is mutated and no caches are recomputed. The caller is
     responsible for catching this and surfacing the invalid-move feedback (see §5.13).
  3. Decrement the tray count (removing the entry at zero).
  4. Write the piece into the board.
  5. Recompute both fit caches (`pieceToFitCells` and `cellToFitPieces`), reflecting the
     new board state regardless of whether `isValid` is `true` or `false`.
  6. Append a `Move` (`{ pieceValue, cell, isValid }`) to `placedCells`.
  - When `preferences.preventInvalidMoves` is `false`, an invalid move still reaches
    steps 3–6: it is applied to the board, the caches are recomputed to reflect the
    (now inconsistent) state, and the move is recorded with `isValid: false`.
- `undoPlay(game)`: pops the last `Move`, returns its piece to the tray, blanks its
  cell, and recomputes both fit caches. Undoing with an empty `placedCells` is
  unhandled in the original (see §8.4) — the rebuild should reproduce this rather than
  add defensive handling, unless the phase reviewer explicitly flags it as worth fixing.

### §3.6 Win / loss detection

The game state is considered **valid** (`stateIsValid`) iff all four hold
simultaneously: every placed move so far has `isValid: true`, every blank cell has
at least one piece that could fit it, every remaining tray piece has at least one cell
it could fit, and the number of blank cells equals the number of remaining tray pieces
(to guard against vacuous-truth edge cases where the tray or board is in an inconsistent
state). When the tray becomes empty (`availablePieces.size === 0`), the game-finished
dialog is shown, using `stateIsValid` to pick a success or failure state.

### §8.3 Difficulty levels are unimplemented

A code comment in `gameBuilder.ts` describes four difficulty tiers (Easy/Medium/Hard/
Expert) as a `TODO`; none of them are implemented — `unfoldGame` runs one unparameterized
strategy regardless of any difficulty setting (there is no difficulty preference in the
UI at all). Replicate the single strategy only (§3.4).

### §8.4 `undoPlay` on an empty move list

`undoPlay` indexes `placedCells[placedCells.length - 1]` without checking for emptiness;
in the UI this is masked because the Undo button is disabled when `placedCells` is empty
(§5.7), so the unsafe path is unreachable through normal play. Replicate the UI guard;
don't add defensive handling inside `undoPlay` itself.

### §8.7 `backlog.md` open items (reference-vs-value equality)

Known discrepancy to reproduce, not fix (full excerpt in `docs/phases/01-domain-core.md`):
comparisons in the original are by reference, not by value, in places that likely intend
value equality. Reproduce the current behavior in `gameBuilder.ts`'s comparisons rather
than switching to value equality, and flag it to the reviewer per the domain-phase (§3,
Phases 1–3) discrepancy note so a human decides whether it's in scope for that track's
"emergent improvement" budget.

Per `docs/CONVENTIONS.md` and requirements.md §7.4, `game/gameBuilder.ts` is a pure
domain module: zero React/UI imports. Per requirements.md §7.3, all domain types are
`readonly`/`ReadonlyArray`/`ReadonlyMap`, and updates are expressed as new objects via
spread (including `Map`s: `new Map(existing.entries())` then `.set`), never in-place
mutation — preserve this discipline in every function added by this phase.

## Acceptance criteria
- `unfoldGame` identifies a filled cell as "locked" only when both hold: (1) none of the
  currently-removed/tray piece values could legally replace it if uncovered, and (2) it
  is not the sole remaining filled neighbor of any of its own neighbors (the isolation
  guard) — cells failing either condition are never selected for removal.
- `unfoldGame` applies the size-dependent tie-breaking rule when choosing which locked
  cell/piece value to remove next: lowest removal-frequency-so-far wins when `size > 4`,
  highest removal-frequency-so-far wins when `size <= 4`.
- `unfoldGame` stops iterating exactly when no locked cells remain in the current board
  state, and does not implement (or reference as active behavior) the commented-out
  Easy/Medium/Hard/Expert difficulty tiers — only the single unparameterized strategy is
  present in the implementation.
- After `unfoldGame` completes, `pieceToFitCells` and `cellToFitPieces` are populated and
  mutually consistent with the unfolded board state.
- `placePiece` computes legality against the current `pieceToFitCells` cache before
  mutating anything.
- `placePiece` throws (without mutating game state) when `preferences.preventInvalidMoves`
  is `true` and the move is invalid.
- `placePiece` does NOT throw when `preferences.preventInvalidMoves` is `false`; instead
  it records the move with `isValid: false`, applies it to the board, and decrements the
  tray count as normal.
- `placePiece` appends a `Move` (`{ pieceValue, cell, isValid }`) to `placedCells` on every
  successful (non-throwing) call, and recomputes both `pieceToFitCells` and
  `cellToFitPieces` afterward.
- `undoPlay` pops the last entry from `placedCells`, returns its piece to the tray, blanks
  its cell on the board, and recomputes both fit caches.
- `undoPlay` has no internal guard/defensive check for an empty `placedCells` array — a
  call against an empty `placedCells` is left unhandled exactly as in the original (this
  is intentional; do not add a length check, early return, or thrown error for this case
  inside `undoPlay`).
- `stateIsValid` returns `true` iff all four hold simultaneously: every entry in
  `placedCells` has `isValid: true`, every blank cell has at least one fitting piece per
  `cellToFitPieces`, every remaining tray piece has at least one fitting cell per
  `pieceToFitCells`, and the number of blank cells equals the number of remaining tray
  pieces (guards against vacuous-truth edge cases).
- Unit tests cover: locked-cell detection (including a case exercising the isolation
  guard), both branches of the size-dependent tie-break (a `size > 4` board and a
  `size <= 4` board), the unfolding stop condition, `placePiece`'s throw-vs-record
  behavior under both values of `preventInvalidMoves`, fit-cache recomputation after both
  `placePiece` and `undoPlay`, and `stateIsValid` covering a valid case and each of
  the four ways it can become invalid (including the blank-cells-vs-tray-pieces
  mismatch).
- `game/gameBuilder.ts` has zero React/UI imports and uses only readonly types and
  non-mutating (spread-based) updates, including for any `Map` state.
- A code comment or test note flags the reference-vs-value equality behavior inherited
  from the original (§8.7) to the human reviewer rather than silently switching affected
  comparisons to value equality.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with these files in place.

## Manual test checklist
N/A — no UI yet; covered by unit tests and `pnpm build`/`pnpm lint`.

## Depends on
- Phase 2 merged.
