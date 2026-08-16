# Phase 06 — Piece rendering — Shapes

## Scope (files this phase may create/modify)
- src/components/PieceDisplay/PieceDisplay.tsx
- src/components/PieceDisplay/PieceDisplay.types.ts
- src/components/PieceDisplay/usePieceDisplayViewModel.ts
- src/components/PieceDisplay/pieceShapeTables.ts
- src/components/PieceDisplay/__tests__/*

## Requirements

From `docs/neighboku-ai-rebuild/requirements.md` §5.3 (Piece rendering — Shapes mode):

> Piece digit 0 (`piece[0]`) selects the form:
>
> | `piece[0]` | Shape |
> |---|---|
> | 0 | Circle (r=15, stroke 5) |
> | 1 | Equilateral triangle (stroke 4) |
> | 2 | Square/rect (stroke 10) |
>
> Stroke (foreground/border) color is keyed by `piece[1]`: `0→red, 1→dodgerblue,
> 2→mediumseagreen`. Fill (background) color is keyed by `piece[2]` when the piece has a
> third dimension (`0→aquamarine, 1→yellow, 2→purple`); for 2-dimensional pieces the fill
> falls back to the same color as the stroke. These are the three attributes referenced by
> the neighbor rule and the video's "form, border, color" description.

Related non-mandatory note from `docs/neighboku-ai-rebuild/requirements.md` §7.5 (Testing
baseline / testing pyramid):

> `PieceDisplay`'s shape/color rendering (§5.3) and the Faces image grid (§5.4) are
> screenshot-test candidates.

This is additive, not required for this phase's floor — see "Optional testing note" under
Acceptance criteria below.

## Acceptance criteria
- `PieceDisplay` follows the fractal component pattern `state,telescope → useXViewModel → RenderX` (`docs/neighboku-ai-rebuild/requirements.md` §7.2), with the file-layout split from `docs/CONVENTIONS.md`: `PieceDisplay.tsx` (component + `RenderPieceDisplay`), `PieceDisplay.types.ts` (props/view-model types only), and one flat `usePieceDisplayViewModel.ts` hook — `PieceDisplay` in Shapes mode is trivial-to-modest complexity (a lookup-table-driven renderer with no local state or user actions), so it does not warrant the `useXDomain`/`useXState`/`useXActions` split reserved for non-trivial components (compare `src/components/CounterDisplay/` vs. `src/components/FaceSwatchBoard/`).
- `pieceShapeTables.ts` exports lookup tables/functions that exactly match §5.3: form keyed by `piece[0]` (0=circle r=15 stroke 5, 1=equilateral triangle stroke 4, 2=square/rect stroke 10), stroke color keyed by `piece[1]` (0=red, 1=dodgerblue, 2=mediumseagreen), and fill color keyed by `piece[2]` (0=aquamarine, 1=yellow, 2=purple).
- For a piece with fewer than 3 dimensions (no `piece[2]`), fill color falls back to the same value as the stroke color, per §5.3's explicit 2-dimensional fallback rule.
- Rendering is a pure function of the piece value: the same piece value (same `piece[0]`/`piece[1]`/`piece[2]`) always renders the same shape, stroke color, and fill color, with no hidden state or randomness.
- Every distinct `base=3, dimension=3` piece value (27 combinations) renders a visually distinct shape/stroke/fill combination per the tables above.
- No Faces-mode logic is implemented in this phase — the Faces branch of `PieceDisplay` (§5.4, image-based rendering keyed by `h{h}e{e}m{m}.png`) is explicitly out of scope here and deferred to Phase 19.
- The app builds, lints, and tests clean (`pnpm build`, `pnpm lint`, `pnpm test`).
- Optional testing note (not required for this phase's floor): `docs/neighboku-ai-rebuild/requirements.md` §7.5 documents `PieceDisplay`'s shape/color rendering as a screenshot-test candidate if that testing tier is later adopted; no browser-mode/screenshot test is required to satisfy this phase.

## Manual test checklist
- Run `pnpm dev`.
- Start (or confirm) a game with `base=3, dimension=3`.
- Visually confirm every distinct piece value renders a visually distinct shape/stroke-color/fill-color combination matching the tables in §5.3 (circle/triangle/square form by `piece[0]`, red/dodgerblue/mediumseagreen stroke by `piece[1]`, aquamarine/yellow/purple fill by `piece[2]`).
- If a 2-dimensional piece is reachable in this phase's test setup, confirm its fill falls back to the same color as its stroke rather than a default/missing fill.
- Confirm no console errors while rendering pieces.

## Depends on
- Phase 5 merged.
