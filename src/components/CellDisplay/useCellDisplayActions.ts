import { useCallback } from "react";
import type { CellDisplayInternals } from "./useCellDisplayState";

/**
 * Split tier (requirements §7.2.1, Phase 12): event-handler closures only, one per
 * user interaction with the §5.2 tooltip — pointer enter, pointer leave, tap. No
 * business logic in a handler body: every decision (is the cell blank? is the
 * preference on? is there anything to list?) was already made by the pure
 * `useCellDisplayDomain` gates the state tier applied — a handler here only commits
 * the interaction.
 *
 * The commit target is the state tier's local setters, not the telescope: the reveal
 * state is cell-local UI state, not game state (no move-engine mutation is involved in
 * revealing a hint — the shared placement path stays on the shell's drag-end monitor,
 * §5.6; Phase 13's click-to-place buttons live on the tray side).
 */
export interface CellDisplayActions {
  readonly onCellMouseEnter: () => void;
  readonly onCellMouseLeave: () => void;
  readonly onCellTap: () => void;
}

export function useCellDisplayActions(
  internals: Readonly<
    Pick<CellDisplayInternals, "setHovered" | "setTapped" | "toggleTapped">
  >,
): CellDisplayActions {
  const { setHovered, setTapped, toggleTapped } = internals;

  const onCellMouseEnter = useCallback(() => {
    setHovered(true);
  }, [setHovered]);

  const onCellMouseLeave = useCallback(() => {
    setHovered(false);
    // Leaving the cell also unpins a tap reveal: on desktop a click during hover must
    // not outlive the hover, and on touch viewports the synthesized mouse-leave that
    // follows a tap elsewhere is what dismisses a tooltip pinned open by an earlier
    // tap on this cell.
    setTapped(false);
  }, [setHovered, setTapped]);

  const onCellTap = useCallback(() => {
    toggleTapped();
  }, [toggleTapped]);

  return { onCellMouseEnter, onCellMouseLeave, onCellTap };
}
