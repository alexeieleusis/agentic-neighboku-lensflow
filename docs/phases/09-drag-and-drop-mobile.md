# Phase 09 — Drag and drop — mobile

## Scope (files this phase may create/modify)
- src/components/DraggablePiece/DraggablePiece.tsx
- src/components/DraggablePiece/DraggablePiece.types.ts
- src/components/DraggablePiece/use*.ts
- src/components/DraggablePiece/__tests__/*
- src/App.tsx
- src/App.types.ts
- src/useApp*.ts

## Requirements

From `docs/neighboku-ai-rebuild/requirements.md` §5.6 (Drag and drop), the bullet this
phase implements (see `docs/phases/08-drag-and-drop-desktop.md` for the full three-bullet
§5.6 excerpt, including the `DragHint`/click-to-place bullets out of scope here):

> - Built on `@dnd-kit/core`; must work with both desktop pointer and mobile touch input.

From `docs/neighboku-ai-rebuild/requirements.md` §7.6 (Device support), in full:

> Must support both desktop pointer-based drag and mobile touch-based drag (the original
> added mobile support as its own follow-up commit — treat it as its own phase, not an
> assumed side effect of the desktop drag work).

Note on scope for this phase: the `DragHint` state-machine/top-bar-icon wiring described in
the second bullet of §5.6 above is explicitly deferred to Phase 14 per the implementation
plan (`docs/neighboku-ai-rebuild/implementation-plan.md` §6, row 14) — this phase is scoped
to making the existing (Phase 8) drag-and-drop path also work under touch input, not to
building the hint icon itself.

## Acceptance criteria
- `@dnd-kit/core` sensors are configured (via `useSensors`/`useSensor` in the same file(s)
  that construct the `DndContext` from Phase 8, e.g. `src/App.tsx` or a dedicated
  `useApp*.ts` hook) to include both a `PointerSensor` (or `MouseSensor`, whichever Phase 8
  used for desktop) and a `TouchSensor`, so the same `DndContext` accepts both input
  modalities simultaneously — no separate mobile-only `DndContext` or code path.
- The same `handleDragEnd` → `placePiece` path wired in Phase 8 is exercised for
  touch-originated drags exactly as it is for pointer-originated drags — no touch-specific
  branching in the drop-handling logic itself, only in sensor configuration.
- The `DndContext`-must-be-ancestor structure from Phase 8 (`docs/CONVENTIONS.md`'s dnd-kit
  gotcha: `useDraggable`/`useDroppable`/`useDndMonitor` must run in a real descendant of
  `<DndContext>`, never in the same function body that constructs it) is preserved —
  adding/configuring touch sensors does not move any hook call out of a `DndContext`
  descendant.
- `DraggablePiece` continues to follow the fractal component pattern
  (`state,telescope → useXViewModel → RenderX`, `docs/neighboku-ai-rebuild/requirements.md`
  §7.2) after any changes made in this phase; if touch-sensor concerns require new
  component-local logic, it is added following the split-hook scale rule in
  `docs/CONVENTIONS.md`, not inlined into `DraggablePiece.tsx` or `RenderDraggablePiece`.
- No regression to Phase 8's desktop pointer drag-and-drop: dragging a piece from the tray
  onto a legal cell with a mouse still places it via `placePiece`, and illegal drops are
  still rejected/flagged per `preventInvalidMoves` exactly as before.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with no errors.

## Manual test checklist
- Run `pnpm dev`.
- Using a touch-emulated device (e.g. browser devtools mobile/touch emulation) or an actual
  touch device, drag a piece from the tray onto a legal cell and confirm it places correctly
  via the same path as desktop drag-and-drop.
- Under the same touch input, attempt an illegal drop and confirm it is rejected or flagged
  per `preventInvalidMoves`, matching Phase 8's desktop illegal-drop behavior.
- Switch back to a mouse/pointer and confirm Phase 8's desktop drag-and-drop still works
  unregressed (legal drop places the piece, illegal drop is rejected/flagged the same way).
- Confirm no console errors during either touch-based or pointer-based drag-and-drop.

## Depends on
- Phase 8 merged.
