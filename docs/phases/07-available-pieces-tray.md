# Phase 07 — Available pieces tray

## Scope (files this phase may create/modify)
- src/components/AvailablePiecesTray/AvailablePiecesTray.tsx
- src/components/AvailablePiecesTray/AvailablePiecesTray.types.ts
- src/components/AvailablePiecesTray/useAvailablePiecesTrayDomain.ts
- src/components/AvailablePiecesTray/useAvailablePiecesTrayViewModel.ts
- src/components/AvailablePiecesTray/AvailablePiecesTray.stories.tsx
- src/components/AvailablePiecesTray/__tests__/*

## Requirements

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.5 (Available pieces tray), quoted
verbatim so this phase has the complete picture:

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

**Scope note (per the implementation plan's phase table, row 7 — "§5.5 (counts + sort
only, defer hint/asterisk/click-to-place)"):** this phase implements ONLY the column
layout, the per-piece remaining counts, the ascending sort by base-10-encoded piece
value, and the `56px × size` tray-width rule from the excerpt above. The `*` unique-cell
hint (`hintAvailablePieceUniqueCell`, second bullet above) and the per-cell
click-to-place button list (`hintPieceCells`, third bullet above) are explicitly OUT OF
SCOPE for this phase — they are deferred to Phase 13 ("Hints: unique-cell asterisk &
click-to-place"). The "draggable piece image" in the second bullet means: render the
piece via the `PieceDisplay` component from Phase 6. Actual drag-and-drop interactivity
(`useDraggable`/`DndContext` wiring) is also out of scope here — that is Phase 8 ("Drag
and drop — desktop"); this phase only needs the static piece image to be present in each
column.

## Acceptance criteria
- `AvailablePiecesTray` follows the fractal component pattern
  `state,telescope → useXViewModel → RenderX` (`docs/neighboku-ai-rebuild/requirements.md`
  §7.2), with the file-layout split from `docs/CONVENTIONS.md`:
  `AvailablePiecesTray.tsx` (component + `RenderAvailablePiecesTray`),
  `AvailablePiecesTray.types.ts` (props/view-model types only, no hook logic),
  `useAvailablePiecesTrayDomain.ts` (pure functions, no React/telescope imports: sorting
  remaining piece values ascending by base-10-encoded value, computing the per-piece
  remaining count, computing tray width from board size), and
  `useAvailablePiecesTrayViewModel.ts` (the orchestrator hook that calls the domain
  functions against the current telescope state and returns the view model — wiring
  only, no business logic inline). This phase has no local non-telescope UI state and no
  user-triggered actions in scope (no click-to-place, no drag handlers), so a separate
  `useAvailablePiecesTrayState.ts`/`useAvailablePiecesTrayActions.ts` split is not
  required this phase per §7.2.1's scale rule — introduce them in a later phase (e.g.
  Phase 13) if/when this component gains local state or user actions.
- The tray renders exactly one column per distinct remaining piece value currently in
  the tray (no columns for piece values with a remaining count of zero).
- Columns are sorted ascending by the piece's base-10-encoded value (per
  `useAvailablePiecesTrayDomain.ts`'s sort function), not by insertion order or any other
  ordering.
- Each column's displayed remaining count exactly matches the actual tray state
  (`availablePieces`) for that piece value, and updates correctly as the underlying tray
  state changes.
- Each column renders the piece's image via the shared `PieceDisplay` component from
  Phase 6 (Shapes mode) — no ad hoc/duplicate shape-rendering logic in
  `AvailablePiecesTray`.
- Tray width scales as `56px × size` (`size` being the current board size), verifiable
  in the rendered DOM/styles.
- Explicit non-goals for this phase, verifiable by absence: no `*` unique-cell hint is
  rendered regardless of `hintAvailablePieceUniqueCell`'s value, and no per-cell
  click-to-place button list is rendered regardless of `hintPieceCells`'s value — both
  are deferred to Phase 13 and must not be implemented here.
- Any new state/types introduced for this component are
  `readonly`/`ReadonlyArray`/`ReadonlyMap`-typed at every level, and any updates are
  expressed as new objects via spread — never in-place mutation, including for `Map`s
  (`docs/neighboku-ai-rebuild/requirements.md` §7.3).
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with no errors.

## Manual test checklist
- Run `pnpm dev` and open the app in a browser.
- Confirm the tray shows exactly one column per distinct remaining piece value (no
  duplicate columns, no columns for pieces with zero remaining count).
- Confirm the columns are sorted left-to-right in ascending order by the piece's
  base-10-encoded value.
- Confirm each column's displayed remaining count matches the actual tray state (cross-
  check against the total number of pieces of that value not yet placed on the board).
- Confirm the tray's width visibly scales with board size (`56px × size`) — start games
  at two different board sizes and confirm the tray is proportionally wider/narrower.
- Confirm no `*` hint characters and no per-cell click-to-place buttons appear in any
  column, regardless of preference values (these are deferred to Phase 13).
- Confirm the browser devtools console shows no errors or warnings while the tray is
  rendered.

## Depends on
- Phase 6 merged.
