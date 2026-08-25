import { useCallback } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import type { TelescopedProps } from "./base/TelescopeComponent.ts";
import type { AppState } from "./App.types.ts";
import { closeInvalidMoveSnackbar, resolveDragDrop } from "./useAppDomain.ts";

export interface AppActions {
  readonly onDragEnd: (event: DragEndEvent) => void;
  /**
   * §5.12 (Phase 11): the invalid-move Snackbar's dismissal. Zero-argument on
   * purpose: MUI invokes a close handler as `(event, reason)` on the `Snackbar`
   * (`onClose`, fired on the 6-second auto-hide / click-away / Escape) and as
   * `(event)` on the `Alert` (`onClose`, fired on its close button — the two
   * callbacks are distinct and MUI does not bridge them), so `RenderApp` hands
   * this one closure to both; the committed next state does not depend on which
   * source fired, only that dismissal happened.
   */
  readonly onInvalidMoveSnackbarClose: () => void;
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
 *
 * Phase 11 adds the shell's second user interaction: dismissing the invalid-move
 * feedback (`onInvalidMoveSnackbarClose`, §5.12). It curries the pure
 * `closeInvalidMoveSnackbar` with the current state and commits through the same
 * telescope as every other shell write — the Snackbar's open/closed state is
 * shell-owned `AppState`, so no local UI state stands in for it.
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

  const onInvalidMoveSnackbarClose = useCallback(() => {
    // Already-closed is a no-op (input reference back), so a doubled dismissal
    // re-emits nothing.
    telescope.update(closeInvalidMoveSnackbar(state));
  }, [state, telescope]);

  useDndMonitor({ onDragEnd });

  return { onDragEnd, onInvalidMoveSnackbarClose };
}
