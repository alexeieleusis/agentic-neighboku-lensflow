# Phase 01 — Domain core: attributes & neighbor rule

## Scope (files this phase may create/modify)
- src/game/entities.ts
- src/game/common.ts
- src/game/__tests__/entities.test.ts
- src/game/__tests__/common.test.ts

## Requirements

### From `docs/neighboku-ai-rebuild/requirements.md` §2 — Glossary (terms relevant to pieces/dimension/base/neighbor)

| Term | Meaning |
|---|---|
| Dimension | Number of attribute axes a piece has (e.g. 3: shape, border color, fill color). |
| Base | Number of possible values per attribute axis (e.g. 3 shapes). |
| Piece | A `dimension`-length vector of digits in `[0, base)`; a piece's identity. |
| Telescope / Lens | TelescopeJS primitives: a `Telescope<T>` is a state container with a change stream and `update`/`evolve`; a `Lens<A,B>` focuses a `Telescope<A>` down to a `Telescope<B>` via a getter/setter pair. |

### From `docs/neighboku-ai-rebuild/requirements.md` §3.1 — Board and pieces

- A board is `size × size` cells. Each non-empty cell holds a `Piece` (a `dimension`-long
  digit vector, base `base`).

(Note for this phase: `buildBoard` — the row-major fill, orthogonal-neighbor candidate
computation, row/column/section exclusion, and "retry whole board on dead end" generation
strategy — belongs to Phase 2; see `docs/phases/02-board-generator.md` for the full §3.1
excerpt. This phase's scope is limited to the `Piece` type/shape and the neighbor-rule
predicate in `entities.ts`/`common.ts` that later phases will build on.)

### From `docs/neighboku-ai-rebuild/requirements.md` §3.2 — Neighbor rule (exact wording)

Two cells are valid neighbors **iff exactly one of their `dimension` attribute positions
has an equal value**. Zero shared attributes or two-or-more shared attributes are both
invalid.

**Adjacency used by the rule is orthogonal only** (up/down/left/right) — see the
discrepancy noted in §8.1.

(Note for this phase: adjacency/board-position concerns belong to a later phase. This
phase implements the attribute-comparison predicate itself — "exactly one shared
attribute position between two pieces" — independent of board adjacency.)

### From `docs/neighboku-ai-rebuild/requirements.md` §7.3 — State management and immutability

All domain and view-model types are `readonly`/`ReadonlyArray`/`ReadonlyMap` at every
level observed in the original (`entities.ts`, all component `.entities.ts` files).
Updates are always expressed as new objects via spread, never in-place mutation, even
for `Map`s (`new Map(existing.entries())` then `.set`). Preserve this discipline; it is
a precondition for the telescope/lens model to behave correctly, not an incidental style
choice.

### From `docs/neighboku-ai-rebuild/requirements.md` §7.4 — Code organization conventions (domain boundary)

Domain logic lives under `src/game/` (`entities.ts`, `common.ts`, `boardBuilder.ts`,
`gameBuilder.ts`) with zero React/UI imports — keep this boundary; it's what makes the
domain layer unit-testable without a DOM.

### Known discrepancy to preserve, not fix (`requirements.md` §8.7)

`backlog.md` (from the original project) notes: "The comparisons everywhere are by
reference, not by value, which causes unexpected behavior" — a known, acknowledged
correctness gap in the original (arrays compared by identity in places that likely
intend value equality). Reproduce the current behavior; do not silently switch to
value-equality comparisons as part of the base rebuild — flag it to the reviewer during
this domain-logic phase so a human decides whether it's in scope for that track's
"emergent improvement" budget.

## Acceptance criteria
- `src/game/entities.ts` defines a `Piece` type (a `dimension`-length vector of digits in
  `[0, base)`) and any accompanying `Dimension`/`Base` types, all `readonly`/
  `ReadonlyArray` at every level — no mutable array/object types are exported from the
  domain layer.
- `src/game/common.ts` (or `entities.ts`, per the implementer's judgment on where the
  predicate naturally lives — either is in this phase's scope) exports a neighbor-rule
  predicate that returns true **iff exactly one** of the two pieces' `dimension`
  attribute positions has an equal value; it returns false for zero shared positions and
  false for two-or-more shared positions.
- No function in `src/game/entities.ts` or `src/game/common.ts` mutates its input
  piece/array arguments in place; updates (where applicable) are expressed as new
  objects/arrays.
- Neither `src/game/entities.ts` nor `src/game/common.ts` imports anything from `react`,
  `@mui/*`, `telescopejs`, or any other UI/view library — grep for `from "react"` (and
  equivalents) across `src/game/` turns up nothing.
- Piece/array equality checks introduced or relied upon in this phase preserve the
  original's observed reference-comparison behavior (e.g. comparing pieces or arrays
  with `===`/`indexOf`/`includes` rather than a deep-equality helper) rather than
  unilaterally switching to value-equality; a comment at the relevant comparison site
  notes this is a known, intentionally-preserved discrepancy per requirements.md §8.7,
  for human review rather than a silent fix.
- Unit tests in `src/game/__tests__/common.test.ts` (or co-located with the predicate)
  cover the neighbor rule's edge cases: two pieces sharing zero attribute positions are
  invalid, two pieces sharing exactly one attribute position are valid, and two pieces
  sharing two-or-more attribute positions are invalid.
- Unit tests in `src/game/__tests__/entities.test.ts` cover basic `Piece` construction/
  shape expectations (dimension length, base range) to the extent `entities.ts` exports
  constructors or validators in this phase.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with these files in place.

## Manual test checklist
N/A — no UI yet; covered by unit tests and `pnpm build`/`pnpm lint`.

## Depends on
- None (first phase).
