import { useCallback } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { UndoButtonState, UndoButtonViewModel } from "./UndoButton.types";

/**
 * Trivial tier (requirements.md §7.2.1, docs/CONVENTIONS.md): a simple leaf with
 * no real state/action complexity keeps one flat view-model hook — this is the
 * rule's canonical example, so no Domain/State/Actions split. `disabled` is the
 * §5.7/§8.4 UI guard against Phase 3's unguarded `undoPlay`; `undo` writes the
 * post-undo slice through the magnified telescope, whose setter (the shell's
 * undo lens) is the commit path that applies `undoPlay` to the shell's `game`.
 */
export function useUndoButtonViewModel(
  props: Readonly<TelescopedProps<UndoButtonState>>,
): UndoButtonViewModel {
  const undo = useCallback(() => {
    props.telescope.update({ placedMoves: props.state.placedMoves - 1 });
  }, [props.telescope, props.state.placedMoves]);

  return {
    disabled: props.state.placedMoves === 0,
    undo,
  };
}
