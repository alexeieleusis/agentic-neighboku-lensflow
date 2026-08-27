import { useCallback, useMemo } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent.ts";
import type { NewGamePanelState } from "./NewGamePanel.types.ts";
import type { NewGamePanelStateInternal } from "./useNewGamePanelState.ts";
import { selectBoardSize } from "./useNewGamePanelDomain.ts";

export interface NewGamePanelActions {
  /**
   * The Board Size select's change handler: applies §4.1's size→dimension
   * rule to the panel's LOCAL selection — a local UI-state move (the state
   * tier's setter), never a telescope write. The selection commits as a
   * whole only on Start; selecting a size on its own changes no shell state.
   */
  readonly onSizeChange: (size: number) => void;
  /**
   * The Start button's commit (§5.9): writes the pending selection — plus
   * the shell's unchanged `base` and a fresh `Date.now()` timestamp —
   * through the slice's magnified telescope. The commit's realization lives
   * in the shell's `NEW_GAME_PANEL_LENS` setter (`useAppViewModel.ts`):
   * rebuild the board with Phase 2's `buildBoard`, unfold a fresh puzzle
   * with Phase 3's `unfoldGame`, reset `gamePlay.startTime`, close the
   * panel — this closure carries no business logic of its own, only the
   * slice value to write and the one thing that is not slice state: the
   * fresh clock reading.
   */
  readonly onStart: () => void;
}

/**
 * Event-handler closures only (requirements §7.2.1, docs/CONVENTIONS.md):
 * each action curries a `useNewGamePanelDomain` function (or, for Start,
 * assembles the slice value to write) with the current local selection /
 * slice state, then commits — no business logic lives directly in an action
 * body.
 *
 * The two actions commit to two different places, on purpose:
 *   - `onSizeChange` → the state tier's local `selection` (no shell state
 *     moves when a size is merely selected, §4.1);
 *   - `onStart` → the slice's magnified telescope (§5.9's one commit: the
 *     written slice value is `{ size, dimension, base, startTime }`, and
 *     the lens setter turns it into the next `AppState` — new board, new
 *     puzzle, fresh clock, drawer closed).
 */
export function useNewGamePanelActions(
  props: Readonly<TelescopedProps<NewGamePanelState>>,
  internal: Readonly<NewGamePanelStateInternal>,
): NewGamePanelActions {
  const { state, telescope } = props;
  const { selection, setSelection } = internal;

  const onSizeChange = useCallback(
    (size: number) => {
      // §4.1's rule, curried with the dimension the panel currently holds:
      // `size >= 8` forces it to 3, `size < 8` leaves it unchanged.
      setSelection(selectBoardSize(selection.dimension, size));
    },
    [selection.dimension, setSelection],
  );

  const onStart = useCallback(() => {
    telescope.update({
      size: selection.size,
      dimension: selection.dimension,
      // §4.1: `base` is not changed by the size selector — the commit carries
      // the shell's own value through, whatever the panel selected.
      base: state.base,
      // §5.9: the clock origin the shell's Start commit stamps — the fresh
      // `Date.now()` lives here, in the action, never in the pure domain
      // tier (which receives it as an argument, like `formatElapsed`'s
      // duration).
      startTime: Date.now(),
    });
  }, [telescope, selection.size, selection.dimension, state.base]);

  return useMemo(() => ({ onSizeChange, onStart }), [onSizeChange, onStart]);
}
