# Phase 02 — Board generator

## Scope (files this phase may create/modify)
- src/game/boardBuilder.ts
- src/game/__tests__/boardBuilder.test.ts

## Requirements

From `docs/neighboku-ai-rebuild/requirements.md` §3.1 (Board and pieces):

> - A board is `size × size` cells. Each non-empty cell holds a `Piece` (a `dimension`-long
>   digit vector, base `base`).
> - Board generation (`buildBoard`) fills cells row-major, left-to-right, top-to-bottom.
>   For each cell it computes the candidate pieces that satisfy the neighbor rule against
>   the cell's already-placed *orthogonal* neighbors (up, left only — later cells aren't
>   placed yet) while excluding pieces already used in the same row, column, or section.
>   Among the candidates, it prefers the ones used **least frequently so far** on the board
>   (a soft global-uniformity heuristic, not a hard rule) and picks randomly among ties. If
>   a cell has zero candidates, the whole board build is retried from scratch (no
>   backtracking) until one succeeds.
> - Rebuild note: reproduce this "generate greedily, retry whole board on dead end"
>   strategy rather than introducing backtracking — this is an intentional simplification
>   in the original, not an oversight, and changing it would change solvability
>   characteristics and generation time in ways that should be a deliberate, reviewed
>   decision, not incidental to the rebuild.

From `docs/neighboku-ai-rebuild/requirements.md` §3.3 (Row / column / section uniqueness):

> Within any row, any column, or any section, no piece value may repeat. Section size is
> `the largest prime factor of the board size` (e.g. size 9 → sections of 3; size 6 →
> sections of 3; size 8 → sections of 2; size 16 → sections of 2). This is computed, not
> configured — carry the same derivation forward rather than hardcoding a section-size
> table.

**Prime board size edge case:** When `size` is a prime number (e.g., 7), the largest prime
factor is `size` itself, so `sectionSize === size` and there is effectively one section
covering the entire board. This is valid behavior — the section uniqueness constraint
simply becomes a global uniqueness constraint across the board. No fallback is needed;
the derivation `sectionSize = largestPrimeFactor(size)` applies uniformly.

Known discrepancy to reproduce, not fix — `docs/neighboku-ai-rebuild/requirements.md` §8.7
(full excerpt in `docs/phases/01-domain-core.md`): "comparisons everywhere are by reference,
not by value" is a known, acknowledged correctness gap in the original. This applies to
Phases 1–3, including this one: where `boardBuilder.ts` compares pieces or arrays (e.g. to
check candidate membership or exclusion), reproduce the original's reference-vs-value
comparison behavior as observed rather than "fixing" it into value equality, and leave a
code comment or PR note flagging the spot(s) for human review.

Domain-boundary and immutability discipline that applies to `src/game/` (from
`docs/CONVENTIONS.md` and `docs/neighboku-ai-rebuild/requirements.md` §7.3/§7.4, full
excerpt and rationale in `docs/phases/01-domain-core.md`): this is a pure domain module,
not a UI component — the `ComponentName.tsx` / `.types.ts` / hook-file split does not apply
here. `src/game/` must have zero React/UI imports, so `boardBuilder.ts` and its tests stay
plain TypeScript with no `react`, `@mui/*`, or `@dnd-kit/*` imports. All domain types are
`readonly`/`ReadonlyArray`/`ReadonlyMap` at every level, with updates always expressed as
new objects via spread (including `Map`s) — preserve this discipline in `boardBuilder.ts`.

## Acceptance criteria
- `buildBoard` fills cells strictly row-major, left-to-right within a row, top-to-bottom across rows.
- Candidate computation for a cell checks the neighbor rule only against its already-placed orthogonal neighbors (up and left) — right/down/diagonal neighbors are never consulted, since they aren't placed yet at fill time.
- Candidate computation excludes any piece already used in the same row, the same column, or the same section as the cell being filled.
- Section size is computed as the largest prime factor of the board `size` (not a hardcoded lookup table), matching the worked examples in §3.3 (size 9 → 3, size 6 → 3, size 8 → 2, size 16 → 2). For prime `size`, `sectionSize === size` (one section covering the full board), which is valid — no special fallback is required.
- Row/column/section uniqueness holds in every board produced by `buildBoard`: no piece value repeats within any row, column, or section.
- Among valid candidates for a cell, the implementation prefers the piece(s) used least frequently so far on the board (soft heuristic, not a hard filter), and breaks ties randomly among the least-frequently-used candidates.
- `buildBoard` accepts an optional `seed?` parameter that initializes a deterministic PRNG for tie-breaking, enabling tests to verify specific board outputs rather than only structural invariants.
- When a cell has zero valid candidates, the entire board build is retried from scratch (no partial-board backtracking) until a full board succeeds.
- The reference-vs-value comparison discrepancy (§8.7) is reproduced as observed (not silently corrected) and flagged via a code comment or PR note for human review.
- Unit tests in `src/game/__tests__/boardBuilder.test.ts` cover, at minimum, the same floor as the original `boardBuilder.test.ts`: `findNeighbors`, `findExclusions`, `buildPossibleNeighbors`, `validNeighbors`, and a smoke test of `buildBoard` (produces a full, valid board without throwing).
- `pnpm build`, `pnpm lint`, and `pnpm test` all pass with `src/game/boardBuilder.ts` and its tests in place.

## Manual test checklist
N/A — no UI yet; covered by unit tests and `pnpm build`/`pnpm lint`.

## Depends on
- Phase 1 merged.
