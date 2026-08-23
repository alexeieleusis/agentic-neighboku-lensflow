import { useMemo } from "react";
import { Lens } from "telescopejs";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { Piece } from "../../game/entities";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";
import type {
  AvailablePiecesTrayColumn,
  AvailablePiecesTrayState,
  AvailablePiecesTrayViewModel,
} from "./AvailablePiecesTray.types";
import {
  TRAY_PIECE_IMAGE_PX,
  sortedRemainingPieces,
  trayRemainingCount,
} from "./useAvailablePiecesTrayDomain";

/**
 * Orchestrator hook (requirements §7.2.1): composes the pure domain tier
 * (`useAvailablePiecesTrayDomain`) with the §7.2 magnified-telescope parent→child flow
 * and stays wiring-only. There is no local non-telescope UI state and no user-triggered
 * action in scope this phase (click-to-place and the `*` hint land in Phase 13,
 * drag-and-drop in Phase 8), so no `useAvailablePiecesTrayState` /
 * `useAvailablePiecesTrayActions` split — the Phase 7 scale-rule call.
 */
export function useAvailablePiecesTrayViewModel(
  props: Readonly<TelescopedProps<AvailablePiecesTrayState>>,
): AvailablePiecesTrayViewModel {
  const { availablePieces } = props.state;

  const columns = useMemo<AvailablePiecesTrayColumn[]>(
    () =>
      sortedRemainingPieces(availablePieces).map((piece) => ({
        piece,
        count: trayRemainingCount(availablePieces, piece),
        pieceImage: {
          state: pieceImageState(piece),
          telescope: props.telescope.magnify(pieceImageLens(piece)),
        },
      })),
    [availablePieces, props.telescope],
  );

  return { columns };
}

/** `AvailablePiecesTrayState` → the piece-image slice one tray column renders. */
function pieceImageState(piece: Piece): PieceDisplayState {
  return { piece, size: TRAY_PIECE_IMAGE_PX };
}

/**
 * The magnification focusing the tray telescope down to the piece image of one distinct
 * piece value. Same deliberate asymmetry as `BOARD_DISPLAY_LENS` in `App.tsx`: the
 * piece value is an immutable domain value and the render size is a tray-level layout
 * constant, so no field of this slice can ever change — writes through it are the
 * identity no-op and the magnified stream simply mirrors.
 */
function pieceImageLens(
  piece: Piece,
): Lens<AvailablePiecesTrayState, PieceDisplayState> {
  return new Lens(
    () => pieceImageState(piece),
    (_pieceImage, trayState) => trayState,
  );
}
