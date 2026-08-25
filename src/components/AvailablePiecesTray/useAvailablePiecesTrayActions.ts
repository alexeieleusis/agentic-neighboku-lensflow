import { useCallback } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { Cell } from "../../game/gameBuilder";
import type { Piece } from "../../game/entities";
import { placeTrayPiece } from "./useAvailablePiecesTrayDomain";
import type { AvailablePiecesTrayState } from "./AvailablePiecesTray.types";

export interface AvailablePiecesTrayActions {
  /**
   * §5.5 third bullet — the shared click-to-place commit handler: one closure for
   * every column's button list, receiving the button's own piece value and cell.
   */
  readonly onPlacePiece: (piece: Piece, cell: Cell) => void;
}

/**
 * Event-handler closures only (requirements §7.2.1, docs/CONVENTIONS.md): each
 * action curries a `useAvailablePiecesTrayDomain` function with the current
 * state/telescope, then commits via `telescope.update` — no business logic lives
 * directly in an action body.
 *
 * `onPlacePiece` is Phase 13's one user action: it hands the button's
 * `(piece, cell)` to `placeTrayPiece` (the domain's delegation to Phase 3's
 * `placePiece` — the same placement function the shell's drag path commits
 * through, so no parallel placement logic exists anywhere in this component) and
 * commits the resulting slice through the tray telescope. The commit reaches the
 * shell through the tray-lens setter in `useAppViewModel.ts`, exactly as the
 * undo button's write reaches it through the undo lens.
 */
export function useAvailablePiecesTrayActions(
  props: Readonly<TelescopedProps<AvailablePiecesTrayState>>,
): AvailablePiecesTrayActions {
  const { state, telescope } = props;

  const onPlacePiece = useCallback(
    (piece: Piece, cell: Cell) => {
      telescope.update(placeTrayPiece(state, piece, cell));
    },
    [state, telescope],
  );

  return { onPlacePiece };
}
