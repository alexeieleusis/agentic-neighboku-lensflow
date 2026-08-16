# Phase 08 — Drag and drop — desktop

## Scope (files this phase may create/modify)
- src/components/DraggablePiece/DraggablePiece.tsx
- src/components/DraggablePiece/DraggablePiece.types.ts
- src/components/DraggablePiece/use*.ts
- src/components/DraggablePiece/__tests__/*
- src/components/AvailablePiecesTray/AvailablePiecesTray.tsx
- src/components/AvailablePiecesTray/use*.ts
- src/components/*/CellDisplay.tsx
- src/components/*/CellDisplay.types.ts
- src/components/*/useCellDisplay*.ts
- src/App.tsx
- src/App.types.ts
- src/use*.ts

## Requirements

### §5.6 Drag and drop (`docs/neighboku-ai-rebuild/requirements.md`)

> - Built on `@dnd-kit/core`; must work with both desktop pointer and mobile touch input.
> - While a piece is being dragged over a cell, the piece being dragged communicates a
>   `DragHint` (`None | Unknown | Ok | NotOk`) up to the top-bar icon via a dedicated
>   telescope (not component props/callbacks) — `Ok`/`NotOk` only when `hintFitOnDrag` is
>   on and the piece is over a droppable target; `Unknown` while dragging without hovering
>   a target; `None` otherwise. The top-bar icon shows: info icon (None/Unknown), thumbs
>   up (Ok), thumbs down (NotOk).
> - Dropping over a valid `cell-{row}-{col}` droppable invokes the same placement path as
>   click-to-place.

**Scope note for this phase**: this phase covers the desktop-pointer portion of §5.6
only. Mobile/touch input support (the "must work with... mobile touch input" clause
above) is explicitly deferred to Phase 9 per the implementation plan and requirements.md
§7.6 ("the original added mobile support as its own follow-up commit — treat it as its
own phase, not an assumed side effect of the desktop drag work"). The `DragHint`
enum/top-bar icon wiring described above is Phase 14's scope in full (state machine +
icon rendering) — this phase only needs the drag-and-drop mechanics and placement to
work end to end; it is acceptable (but not required) for `DraggablePiece.types.ts` to
declare the `DragHint` type as a forward-looking placeholder if it falls out naturally
from the telescope wiring, but implementing the icon or the `hintFitOnDrag`-gated
Ok/NotOk/Unknown logic itself is out of scope here.

### §7.5 Testing baseline (relevant excerpt, `docs/neighboku-ai-rebuild/requirements.md`)

> This project has two genuine real-browser cases beyond that: `@dnd-kit` drag-and-drop
> (Phases 8–9, 14) ... need interaction tests.

This is an OPTIONAL/additive testing-pyramid note, not required for this phase's floor
(see `docs/CONVENTIONS.md`'s own framing of real-browser interaction tests as out of
scope for this template). Domain-function and hook-level unit tests remain the required
floor for this phase.

### dnd-kit: `DndContext` must be an ancestor, not set up inline in the same component (`docs/CONVENTIONS.md`)

> `useDraggable`, `useDroppable`, and `useDndMonitor` all register themselves via React
> context. That context only exists **inside** `<DndContext>`'s subtree. Concretely: a
> component's own function body runs *before* the JSX it returns is mounted, so if that
> same function both calls a hook that needs the context **and** constructs the
> `<DndContext>` element it returns, the hook call happens too early — it's part of
> `<DndContext>`'s *parent's* render, not a descendant's. The registration silently
> no-ops: no error, no crash, just a droppable/monitor that never receives any drag
> events.
>
> ```tsx
> // ❌ Broken: useDroppable (inside useXViewModel) runs before <DndContext> exists.
> function MyBoard(props) {
>   const viewModel = useMyBoardViewModel(props); // calls useDroppable internally
>   return <DndContext onDragEnd={viewModel.onDragEnd}>{/* ... */}</DndContext>;
> }
>
> // ✅ Correct: split into an outer component that only sets up DndContext, and an
> // inner component — a real descendant — that does the view-model work.
> function MyBoard(props) {
>   return (
>     <DndContext>
>       <MyBoardConnected {...props} />
>     </DndContext>
>   );
> }
> function MyBoardConnected(props) {
>   const viewModel = useMyBoardViewModel(props); // now correctly inside DndContext
>   useDndMonitor({ onDragEnd: viewModel.onDragEnd });
>   return RenderMyBoard(viewModel);
> }
> ```
>
> This is exactly the bug `FaceSwatchBoard` shipped with initially ... drag-start worked
> (`DraggableFaceTile`'s `useDraggable` genuinely was a `DndContext` descendant), but the
> drop slot's `useDroppable` never registered, so `onDragEnd`'s `event.over` was always
> `null` no matter the target size or DOM element used. If a future phase adds a
> droppable/draggable and drops stop registering with `over` always `null`, check this
> first before suspecting collision-detection geometry.

`src/components/FaceSwatchBoard/FaceSwatchBoard.tsx` is the reference implementation of
the corrected pattern in this repo: an outer `FaceSwatchBoard` component that only
returns `<DndContext>...<FaceSwatchBoardConnected {...props} /></DndContext>`, and an
inner `FaceSwatchBoardConnected` — a true descendant — that calls
`useFaceSwatchBoardViewModel` and `useDndMonitor`. Per §5.1, the board and the piece
tray must sit inside one shared `DndContext` (so a piece can be dragged from the tray
and dropped on the board), so this phase's `DndContext` ancestor lives in `src/App.tsx`
(or an equivalent shell-level ancestor/connected split within it) rather than inside
`AvailablePiecesTray` or `BoardDisplay` individually — those components' own
`useDraggable`/`useDroppable` calls must run as descendants of that shared shell-level
`DndContext`, not construct their own.

## Acceptance criteria
- `DraggablePiece` follows the fractal component pattern `state,telescope → useXViewModel → RenderX` (requirements.md §7.2), with the file-layout split from `docs/CONVENTIONS.md` (`DraggablePiece.tsx` + `DraggablePiece.types.ts` + one or more `useDraggablePiece*.ts` hook files, split per the §7.2.1/CONVENTIONS scale rule only if the component's local logic is non-trivial).
- A shared `DndContext` is set up as a true ANCESTOR — in a distinct outer component that does nothing but render `<DndContext>` around an inner descendant component — of every component in this phase's scope that calls `useDraggable`, `useDroppable`, or `useDndMonitor` (`AvailablePiecesTray`'s draggable pieces, `CellDisplay`'s droppable cells, and the shell's drag-end monitor). This is a blocking acceptance criterion, not a style nit: per `docs/CONVENTIONS.md`'s dnd-kit gotcha, calling one of these hooks in the same function body that constructs the `<DndContext>` element silently no-ops (no error, no crash — `event.over` is always `null`). `src/components/FaceSwatchBoard/FaceSwatchBoard.tsx`'s outer `FaceSwatchBoard`/inner `FaceSwatchBoardConnected` split is the reference pattern this phase must follow, not the broken single-component pattern it originally shipped with.
- Drag-and-drop is implemented using `@dnd-kit/core` (`useDraggable`, `useDroppable`, `DndContext`, `useDndMonitor`/`onDragEnd`), consistent with the already-installed version used by `FaceSwatchBoard`.
- Each tray piece is wrapped in (or rendered as) a `DraggablePiece` registered via `useDraggable`, and each blank board cell is registered as a droppable with id `cell-{row}-{col}` (1-indexed or 0-indexed consistent with the rest of the board's row/column addressing) via `useDroppable`.
- A `handleDragEnd` action, invoked from `onDragEnd`/`useDndMonitor`, reads the dropped piece's value and the target cell from the drag event and calls `placePiece(pieceValue, cell, game)` from Phase 3's `game/gameBuilder.ts` — the same move-engine function click-to-place will later call (Phase 7 predates click-to-place per the implementation plan, so click-to-place buttons themselves are not required by this phase; the requirement is that `handleDragEnd` goes through `placePiece`, the single shared placement path).
- Dropping a dragged piece over a valid `cell-{row}-{col}` droppable results in the same board/tray state changes that placing that piece there via `placePiece` directly would produce (board cell filled, tray count decremented, `placedCells`/fit caches updated per §3.5).
- Dropping a piece where `preventInvalidMoves` is `true` (the default, §4.2) and the target is not a legal placement causes `placePiece` to throw and the board/tray to remain unchanged (no partial mutation) — this phase does not need to implement the Snackbar UI feedback for the caught error (that's Phase 11's scope), but the throw must be caught somewhere in the drag-end handling path so it doesn't crash the app, and no invalid move may be silently applied to the board while `preventInvalidMoves` is `true`.
- Dropping a dragged piece outside any registered droppable (`event.over` is `null`) is a no-op: no call to `placePiece`, no board/tray mutation.
- End-to-end desktop pointer input works: a piece can be picked up with the mouse/pointer from the tray, dragged over the board, and dropped to place it, with no `@dnd-kit` touch/mobile sensor configuration added in this phase — mobile/touch sensor setup (`TouchSensor`/`PointerSensor` mobile tuning, per requirements.md §7.6) is explicitly OUT of scope here and deferred to Phase 9.
- Any new/modified state (e.g. on `App.types.ts` or `DraggablePiece.types.ts`) is `readonly`/`ReadonlyArray`/`ReadonlyMap`-typed, and updates are expressed as new objects via spread — never in-place mutation — per requirements.md §7.3.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with no errors.

## Manual test checklist
- Run `pnpm dev` and open the app in a browser.
- Drag a piece from the tray onto a legal, empty cell using the mouse; confirm it places correctly (the cell shows the piece, the tray's count for that piece value decrements, and if the tray count reaches zero the piece's tray entry disappears).
- Attempt to drag a piece onto a cell where it would be an illegal placement; with `preventInvalidMoves` at its default (`true`, per §4.2/§3.5), confirm the drop is rejected — the board and tray must be unchanged afterward, matching the "throws, doesn't mutate" behavior of `placePiece`.
- Drag a piece and drop it outside any board cell (e.g. back over the tray or empty page area); confirm this is a no-op — no board or tray change.
- Confirm the browser devtools console shows no errors during any of the above (pick-up, valid drop, invalid drop, drop-outside-target).

## Depends on
- Phase 7 merged.
