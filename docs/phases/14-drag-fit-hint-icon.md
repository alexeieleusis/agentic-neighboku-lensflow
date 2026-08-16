# Phase 14 — Drag-fit hint icon

## Scope (files this phase may create/modify)
- src/components/DraggablePiece/DraggablePiece.tsx
- src/components/DraggablePiece/DraggablePiece.types.ts
- src/components/DraggablePiece/use*.ts
- src/components/DraggablePiece/__tests__/*
- src/components/DragFitHintIcon/DragFitHintIcon.tsx
- src/components/DragFitHintIcon/DragFitHintIcon.types.ts
- src/components/DragFitHintIcon/use*.ts
- src/components/DragFitHintIcon/__tests__/*
- src/App.tsx
- src/App.types.ts
- src/use*.ts

## Requirements

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.6 (Drag and drop), the bullet this
phase implements (see `docs/phases/08-drag-and-drop-desktop.md` for the full three-bullet
§5.6 excerpt):

> - While a piece is being dragged over a cell, the piece being dragged communicates a
>   `DragHint` (`None | Unknown | Ok | NotOk`) up to the top-bar icon via a dedicated
>   telescope (not component props/callbacks) — `Ok`/`NotOk` only when `hintFitOnDrag` is
>   on and the piece is over a droppable target; `Unknown` while dragging without hovering
>   a target; `None` otherwise. The top-bar icon shows: info icon (None/Unknown), thumbs
>   up (Ok), thumbs down (NotOk).

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.11 (Hints summary cross-reference),
the row relevant to this phase, quoted verbatim:

> | Hint | Preference | Behavior |
> |---|---|---|
> | Drag ok/not-ok icon | `hintFitOnDrag` | §5.6 |

**Phase boundary note (not part of the literal excerpts above):** Phases 8–9 built desktop
and mobile drag-and-drop end to end (`DraggablePiece`, the shared shell-level `DndContext`,
`handleDragEnd` → `placePiece`) but explicitly deferred the `DragHint` state machine and the
top-bar icon itself to this phase — see `docs/phases/08-drag-and-drop-desktop.md` and
`docs/phases/09-drag-and-drop-mobile.md`. This phase is scoped to building that state machine
and the icon that renders it; it does not change the underlying drag-and-drop mechanics or the
placement path those phases already wired.

**Architecture note on the telescope shape (not part of the literal excerpts above):** the
`DragHint` value does not flow parent→child — `DraggablePiece` (inside the tray/board subtree)
and the top-bar icon (inside the shell's top bar) are siblings under `App`, neither an ancestor
of the other. Per `docs/CONVENTIONS.md` and `requirements.md` §7.2, parent→child state still
flows through a magnified telescope, never raw callback props; the way that composes here is:
a `DragHint` slice lives on a shared ancestor's state (e.g. `AppState`, alongside/adjacent to
the rest of the shell state established in Phase 4), and `App`'s `useAppViewModel` hands out
two independent magnified telescopes onto that same slice — one to `DraggablePiece` (or its
drag-end/drag-move action hook) for writing the hint as drag state changes, and one to
`DragFitHintIcon` for reading it to choose which icon to render. This is the "dedicated
telescope" the requirement calls for: it must be its own lens onto its own `DragHint` slice,
not a reuse of a general-purpose shell telescope carrying unrelated state, and not a raw
callback prop passed down into `DraggablePiece` or back up out of it.

Per `docs/CONVENTIONS.md`'s dnd-kit gotcha (`DndContext` must be an ancestor, not set up
inline in the same component — see `docs/phases/08-drag-and-drop-desktop.md` for the full
excerpt and the `FaceSwatchBoard` reference implementation, since this phase touches
`DraggablePiece` and its drag-lifecycle hooks): this phase does not add any new
droppable/draggable registration, but any hook that observes drag lifecycle to compute the
current `DragHint` (e.g. via `useDndMonitor`, or by reading `@dnd-kit`'s active/over state)
must still run as a real descendant of the shell-level `DndContext` established in Phase 8,
per this same gotcha.

## Acceptance criteria
- `DraggablePiece.types.ts` defines the `DragHint` state machine type as the exact four-value union `"None" | "Unknown" | "Ok" | "NotOk"` (or an equivalent exhaustive representation, e.g. a matching string enum) — no fifth value, no partial/optional representation.
- The current `DragHint` value is communicated from the dragged piece up to the top-bar icon component via a DEDICATED magnified telescope (its own lens onto its own `DragHint` slice, per the architecture note above) — not raw props, not a callback function passed into or out of `DraggablePiece`, and not piggybacked onto an unrelated general-purpose telescope.
- `Ok` and `NotOk` are computed only when both hold simultaneously: `preferences.hintFitOnDrag` is `true`, and the dragged piece is currently over a registered droppable target (`event.over` non-null in `@dnd-kit` terms); `Ok` when that target is a legal placement for the dragged piece, `NotOk` when it is not.
- `Unknown` is the value while a drag is in progress but no droppable target is currently hovered (`event.over` is `null`), regardless of `hintFitOnDrag`.
- `None` is the value whenever no drag is in progress (before drag-start, and immediately after drag-end or drag-cancel).
- A new or existing top-bar icon component, `src/components/DragFitHintIcon/DragFitHintIcon.tsx` (+ `DragFitHintIcon.types.ts` + `useDragFitHintIcon*.ts` hook(s)), renders into the top-bar slot Phase 4 reserved for the drag-fit-hint icon (`docs/phases/04-app-shell.md`) and shows exactly the three documented icon states: an info icon for `None` and `Unknown`, a thumbs-up icon for `Ok`, a thumbs-down icon for `NotOk`.
- `DragFitHintIcon` follows the `state,telescope → useXViewModel → RenderX` fractal pattern (`requirements.md` §7.2); if its view-model logic is non-trivial, it uses the split-hook layout (`useDragFitHintIconDomain.ts` / `useDragFitHintIconState.ts` / `useDragFitHintIconActions.ts` / `useDragFitHintIconViewModel.ts`) per `docs/CONVENTIONS.md`'s scale rule; a flat single `useDragFitHintIconViewModel.ts` is acceptable if the component stays a trivial leaf that only maps `DragHint` to an icon.
- `DraggablePiece` continues to follow the same fractal pattern and, per the split-hook scale rule, gains no business logic (the `DragHint`-computation rules above) inlined directly into `DraggablePiece.tsx`, `RenderDraggablePiece`, or a bare event-handler body — that logic lives in a domain function, curried by an action hook that commits the result via the dedicated telescope's `update`/`evolve`.
- No hook that observes `@dnd-kit` drag lifecycle to compute `DragHint` is called from the same component function body that constructs the shell's `<DndContext>` element — it runs in a real descendant, consistent with the `DndContext`-ancestor gotcha excerpted above and with how Phase 8 already split `App`/shell components.
- `DraggablePiece.types.ts` and `DragFitHintIcon.types.ts` hold only props/view-model types — no hook logic — per `docs/CONVENTIONS.md`'s file-layout convention.
- Any new/modified state (the `DragHint` slice on the shared ancestor state, and any local `DragFitHintIcon`/`DraggablePiece` state) is `readonly`-typed and updated via new objects (spread), never in-place mutation, per `requirements.md` §7.3.
- No regression to Phases 8–9's drag-and-drop mechanics: a piece can still be picked up, dragged, and dropped to place it (or rejected per `preventInvalidMoves`) via both pointer and touch input, unchanged by this phase's additions.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with no errors.
- Optionally, not required for this phase's floor: `requirements.md` §7.5 lists this drag interaction as a documented interaction-test candidate (alongside Phases 8–9) if that testing tier is later adopted; its absence here is not a phase boundary violation.

## Manual test checklist
- Run `pnpm dev` and open the app in a browser, with `hintFitOnDrag: true` (the default preference, per `requirements.md` §4.2).
- Start dragging a piece from the tray without hovering it over any droppable cell; confirm the top-bar drag-fit-hint icon shows the info icon (the `Unknown` state).
- While still dragging, move the piece over a cell where placing it would be a legal move; confirm the icon switches to the thumbs-up icon (the `Ok` state).
- While still dragging, move the piece over a different cell where placing it would be an illegal move; confirm the icon switches to the thumbs-down icon (the `NotOk` state).
- Release the drag over a valid target (or cancel it, e.g. by pressing Escape or dropping outside any droppable) and confirm the icon returns to the info icon (the `None` state) once the drag ends.
- Note: testing the `hintFitOnDrag: false` case requires a temporary preference edit, the same workaround `docs/phases/11-invalid-move-feedback.md` used, since the Preferences panel that exposes this toggle doesn't ship until Phase 16 (`requirements.md` §5.8). Temporarily edit the `hintFitOnDrag` default to `false` in the preferences source (or write it directly into the persisted preferences object in `localStorage`) for the duration of this check only, and revert it afterward.
- With the `hintFitOnDrag: false` workaround in effect, drag a piece over both a legal and an illegal target and confirm the icon stays on the info icon (`Unknown`) for the whole drag — no thumbs-up/thumbs-down ever appears — matching the "`Ok`/`NotOk` only when `hintFitOnDrag` is on" rule.
- Confirm the browser devtools console shows no errors throughout any of the above.

## Depends on
- Phase 13 merged.
