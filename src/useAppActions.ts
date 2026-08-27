import { useCallback, useMemo } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import type { TelescopedProps } from "./base/TelescopeComponent.ts";
import type { AppState } from "./App.types.ts";
import type { AppInternalState } from "./useAppState.ts";
import type { DragLifecycleEvent } from "./useAppDomain.ts";
import {
  closeInvalidMoveSnackbar,
  resolveDragDrop,
  resolveDragHint,
} from "./useAppDomain.ts";
import { DRAG_HINT_LENS } from "./useAppViewModel.ts";

export interface AppActions {
  readonly onDragEnd: (event: DragEndEvent) => void;
  /**
   * §5.6 (Phase 14): the drag-lifecycle hint commits. `onDragStart`/`onDragOver`
   * write the in-progress hint (`Unknown` / `Ok` / `NotOk`, per
   * `resolveDragHint`'s state machine), `onDragCancel` (and `onDragEnd`, after its
   * placement commit) write the drag's end back to `None`. All four are registered
   * with the shell-level `DndContext` through the same `useDndMonitor` as
   * `onDragEnd`, and all commit through the dedicated `dragHint` telescope — never
   * through component props/callbacks and never through the shell's general
   * telescope (requirements §5.6). `onDragStart`/`onDragCancel` take no event
   * argument on purpose: the monitor events they answer to carry no field the hint
   * depends on (start has no hovered target yet; end/cancel only mean "no drag
   * anymore"), so reading one would be a prop-drill of data that is never used.
   */
  readonly onDragStart: () => void;
  readonly onDragOver: (event: DragOverEvent) => void;
  readonly onDragCancel: () => void;
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
  /**
   * §5.13 (Phase 15): the game-finished Dialog's dismissal. Zero-argument on
   * purpose: MUI invokes a Dialog's `onClose` as `(event, reason)` on both its
   * Escape-key and backdrop-click dismissal, and the committed next state does
   * not depend on which source fired, only that dismissal happened. Unlike
   * every other shell action, this one does not commit through the telescope:
   * the dismissal is the shell's local UI state (Phase 15's `useAppState`
   * tier — §7.2.1's "dialog open/closed"), not `AppState`, so the action just
   * flips that flag. The Dialog itself stays a pure derivation: open exactly
   * while the tray is empty and not dismissed.
   */
  readonly onGameFinishedDialogClose: () => void;
  /**
   * §5.8 (Phase 16): the top-bar Preferences button's (gear icon's) click —
   * toggles the preferences drawer open/closed. Like the finished-game
   * Dialog's dismissal, this does not commit through the telescope: the
   * open/closed flag is the shell's local UI state (Phase 16's `useAppState`
   * tier), so the action just flips it.
   */
  readonly onPreferencesToggle: () => void;
  /**
   * §5.8 (Phase 16): the preferences drawer's dismissal — MUI fires its
   * `onClose` as `(event, reason)` on both the backdrop-click and
   * Escape-key paths, and the committed next state does not depend on which
   * source fired, so this is zero-argument on purpose: it just closes the
   * drawer through the state tier's setter.
   */
  readonly onPreferencesDrawerClose: () => void;
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
 *
 * Phase 14 adds the §5.6 drag-fit hint's lifecycle to the same monitor: `onDragStart`
 * (the hint goes `Unknown` — a drag is in progress and no target is hovered yet),
 * `onDragOver` (dnd-kit fires it exactly when the hovered droppable target changes —
 * the hint is `Ok`/`NotOk`/`Unknown` per `resolveDragHint`), and `onDragCancel` (the
 * hint returns to `None`, as `onDragEnd` does after its placement commit). Each of
 * these curries the pure `resolveDragHint` state machine with the current shell state
 * and commits the result through the shell's dedicated `dragHint` telescope — an
 * independent magnification of `DRAG_HINT_LENS`, so the write lands on the hint slice
 * only, through the live shell state, without touching the board/tray slices or the
 * general telescope.
 *
 * Phase 15 adds the game-finished Dialog's dismissal (§5.13, `onGameFinishedDialogClose`):
 * MUI fires it on Escape / backdrop click; it flips the shell's local dismissal flag
 * (the `useAppState` tier's `dialogDismissed`) rather than committing through the
 * telescope, because the dismissal is component-local UI state, not `AppState` — the
 * Dialog's open state stays a pure derivation (tray empty AND not dismissed).
 *
 * Phase 16 adds the preferences drawer's open/close (§5.8, `onPreferencesToggle` /
 * `onPreferencesDrawerClose`): the gear icon toggles the shell's local
 * `preferencesDrawerOpen` flag (the `useAppState` tier) and the drawer's own
 * `onClose` (backdrop click / Escape) closes it — the same local-UI-state shape as
 * the finished-game Dialog's dismissal, never a telescope write.
 *
 * This hook therefore takes the state tier's internal shape (`AppInternalState`)
 * alongside the telescoped props: the orchestrator (`useAppViewModel`) creates it
 * once and passes it down, so the dismissal flag has a single source of truth shared
 * by the state tier (which derives `dialogOpen` from it) and this action (which sets
 * it).
 */
export function useAppActions(
  props: Readonly<TelescopedProps<AppState>>,
  internal: Readonly<AppInternalState>,
): AppActions {
  const { state, telescope } = props;

  /**
   * The WRITE side of the §5.6 DragHint channel (Phase 14): this hook's own
   * magnified telescope onto the shell's `dragHint` slice — independent from the one
   * `useAppViewModel` hands the top bar's `DragFitHintIcon` for reading, and from the
   * shell's general telescope the placement commits through. Writing the hint value
   * through it composes onto the shell's live state (the lens setter receives the
   * current `AppState`, so a hint reset committed just after a placement commit lands
   * on the placement's next state), and is a no-op — same reference back, no stream
   * re-emission — when the value is already what the slice holds.
   */
  const dragHintTelescope = useMemo(
    () => telescope.magnify(DRAG_HINT_LENS),
    [telescope],
  );

  const commitDragHint = useCallback(
    (event: DragLifecycleEvent) => {
      dragHintTelescope.update(resolveDragHint(state, event));
    },
    [state, dragHintTelescope],
  );

  // No event parameter: the start event carries no hovered target yet, so the hint
  // is unconditional — the domain's `start` branch decides.
  const onDragStart = useCallback(() => {
    commitDragHint({ kind: "start" });
  }, [commitDragHint]);

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      commitDragHint({
        kind: "over",
        activeId: String(event.active.id),
        overId: event.over === null ? null : String(event.over.id),
      });
    },
    [commitDragHint],
  );

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
      // Phase 14: the drag is over, so the hint returns to `None` — committed through
      // the dedicated telescope AFTER the placement commit, so it composes onto the
      // placement's next state (the lens setter runs against the live shell state).
      commitDragHint({ kind: "end" });
    },
    [state, telescope, commitDragHint],
  );

  // No event parameter: a cancelled drag (e.g. Escape mid-drag) places nothing —
  // only the hint returns to `None`, again through the dedicated telescope.
  const onDragCancel = useCallback(() => {
    commitDragHint({ kind: "cancel" });
  }, [commitDragHint]);

  const onInvalidMoveSnackbarClose = useCallback(() => {
    // Already-closed is a no-op (input reference back), so a doubled dismissal
    // re-emits nothing.
    telescope.update(closeInvalidMoveSnackbar(state));
  }, [state, telescope]);

  // §5.13 (Phase 15): the finished-game Dialog's dismissal. The only commit here is
  // the local flag itself (a `true` → `true` re-set is a no-op re-render-free
  // update), so no domain curry is involved — the open/closed derivation lives in
  // the state tier, not in this closure.
  const onGameFinishedDialogClose = useCallback(() => {
    internal.setDialogDismissed(true);
  }, [internal]);

  // §5.8 (Phase 16): the gear icon's toggle — flip the state tier's local
  // drawer flag; a second click while open closes it (the drawer's own
  // `onClose` covers the backdrop/Escape paths).
  const onPreferencesToggle = useCallback(() => {
    internal.setPreferencesDrawerOpen(!internal.preferencesDrawerOpen);
  }, [internal]);

  // §5.8 (Phase 16): the drawer's dismissal (MUI's `onClose` — backdrop click
  // or Escape). The only commit is the local flag itself, as with the
  // finished-game Dialog's dismissal above.
  const onPreferencesDrawerClose = useCallback(() => {
    internal.setPreferencesDrawerOpen(false);
  }, [internal]);

  useDndMonitor({ onDragStart, onDragOver, onDragEnd, onDragCancel });

  return {
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
    onInvalidMoveSnackbarClose,
    onGameFinishedDialogClose,
    onPreferencesToggle,
    onPreferencesDrawerClose,
  };
}
