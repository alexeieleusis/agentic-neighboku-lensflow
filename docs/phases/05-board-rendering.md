# Phase 05 — Board rendering

## Scope (files this phase may create/modify)
- src/components/BoardDisplay/BoardDisplay.tsx
- src/components/BoardDisplay/BoardDisplay.types.ts
- src/components/BoardDisplay/useBoardDisplayViewModel.ts
- src/components/BoardDisplay/BoardDisplay.stories.tsx
- src/components/RowDisplay/RowDisplay.tsx
- src/components/RowDisplay/RowDisplay.types.ts
- src/components/RowDisplay/useRowDisplayViewModel.ts
- src/components/RowDisplay/RowDisplay.stories.tsx
- src/components/CellDisplay/CellDisplay.tsx
- src/components/CellDisplay/CellDisplay.types.ts
- src/components/CellDisplay/useCellDisplayViewModel.ts
- src/components/CellDisplay/CellDisplay.stories.tsx
- src/components/{BoardDisplay,RowDisplay,CellDisplay}/**

## Requirements

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.2 (Board rendering), quoted verbatim:

> ### 5.2 Board rendering
>
> - Grid of cells, one row per board row, laid out via CSS grid.
> - Cells are colored to visually group sections (background color keyed to section, per
>   `CellDisplay`'s `backgroundColor`/`gridRow`/`gridColumn` view-model fields) — exact
>   color values are a styling decision for the rebuild, but the section grouping must be
>   visually legible.
> - A blank cell shows its `pieceType`-appropriate droppable target; if
>   `hintFitPieceCount` is on, it shows the count of pieces that would legally fit there;
>   if `showFitPiecesOnHover` is on, hovering/tapping a blank cell reveals a tooltip
>   listing every piece that would fit.
> - A filled cell renders its piece via the shared piece-rendering component (§5.3/§5.4).

**Phase 5 scope note (not part of the literal excerpt above):** `hintFitPieceCount` and
`showFitPiecesOnHover` are explicitly **out of scope** for this phase — that hint logic
is deferred to Phase 12 per the implementation plan. Do not implement the fit-count
display or the hover/tap tooltip here; a blank cell only needs to render its
`pieceType`-appropriate droppable-target placeholder, with no count or tooltip attached.
Likewise, the "shared piece-rendering component" referenced in the last bullet (§5.3/§5.4,
Shapes/Faces piece rendering) does not exist until Phase 6. This phase must not block on
it — render a filled cell with a placeholder or minimal inline representation of the
piece (e.g. a plain labeled box) instead of the real piece graphic, and leave a clear spot
for Phase 6 to swap that placeholder for the real shared component.

## Acceptance criteria
- `BoardDisplay`, `RowDisplay`, and `CellDisplay` each follow the `state,telescope →
  useXViewModel → RenderX` fractal pattern (`docs/fractal_component.md`,
  `requirements.md` §7.2), with parent→child state flow via a magnified telescope
  (`telescope.magnify(new Lens(get, set))`) — not prop-drilled callbacks.
- Each component's file layout matches `docs/CONVENTIONS.md`: a `ComponentName.tsx`
  (component function + `RenderComponentName`), a `ComponentName.types.ts` (props type +
  view-model type only, no hook logic), and a single flat `useComponentNameViewModel.ts`.
  All three components are trivial in this phase's scope (no local UI state, no user
  actions, no dnd-kit hook registration yet) per the `CounterDisplay`-style scale rule —
  none of them should be split into `Domain`/`State`/`Actions` files in this phase.
- `BoardDisplay` renders the board as a CSS grid with exactly one row and one column per
  board row/column for the current board `size`.
- `CellDisplay`'s view model exposes `backgroundColor`, `gridRow`, and `gridColumn`
  fields, and `RowDisplay`/`BoardDisplay` wire them into the grid's styling so every cell
  is positioned in its correct grid row/column.
- Section membership is visually legible: cells belonging to different sections render
  with visibly distinct background colors (exact color values are a free styling
  decision, not specified by requirements).
- Blank cells render a `pieceType`-appropriate droppable-target placeholder; filled cells
  render a minimal placeholder/inline representation of their piece (not the shared
  piece-rendering component, which doesn't exist until Phase 6) — blank and filled cells
  must be visibly distinguishable from each other.
- No `hintFitPieceCount` or `showFitPiecesOnHover` logic (fit-count display, hover/tap
  tooltip) is implemented anywhere in this phase's components — this is an explicit
  non-goal, deferred to Phase 12, not an oversight a reviewer should flag as missing.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with this phase's changes.

## Manual test checklist
- Run `pnpm dev` and open the app.
- Confirm the board grid renders a full board with the correct row and column count for
  the current board size (e.g. the default 6×6 preference renders a 6×6 grid).
- Confirm sections are visually distinguishable via distinct background coloring per
  section.
- Confirm blank cells and filled cells are visibly different from each other.
- Confirm no errors appear in the browser console.

## Depends on
- Phase 4 merged.
