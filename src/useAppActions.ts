import { useCallback } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import type { TelescopedProps } from "./base/TelescopeComponent.ts";
import type { AppState } from "./App.types.ts";
import { resolveDragDrop } from "./useAppDomain.ts";

export interface AppActions {
  readonly onDragEnd: (event: DragEndEvent) => void;
}

/**
 * The shell's action tier (requirements §7.2.1/Phase 8): one event handler per user
 * interaction. `onDragEnd` reads the dropped piece's value and the target cell off the
 * drag event's ids and commits through `placePiece` — curried entirely in the pure
 * `resolveDragDrop` domain function; this closure adds no logic of its own.
 *
 * It is registered with the shell-level `DndContext` via `useDndMonitor`. That hook
 * registers through React context and THROWS outside a `<DndContext>` descendant, so
 * this hook must run in a true descendant — `AppConnected` in `App.tsx` — never in the
 * function that constructs the `<DndContext>` element (docs/CONVENTIONS.md dnd-kit
 * note; this is the same registration class as `useDraggable`/`useDroppable`).
 */
export function useAppActions(
  props: Readonly<TelescopedProps<AppState>>,
): AppActions {
  const { state, telescope } = props;

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      // A no-op `resolveDragDrop` result is the same state reference; the telescope's
      // stream is `distinctUntilChanged`, so such updates re-emit nothing.
      telescope.update(
        resolveDragDrop(state, {
          activeId: String(event.active.id),
          overId: event.over === null ? null : String(event.over.id),
        }),
      );
    },
    [state, telescope],
  );

  useDndMonitor({ onDragEnd });

  return { onDragEnd };
}
