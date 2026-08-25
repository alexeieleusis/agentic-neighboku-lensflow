import { useMemo } from "react";
import { Lens } from "telescopejs";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { Piece } from "../../game/entities";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";
import type {
  AvailablePiecesTrayColumn,
  AvailablePiecesTrayState,
} from "./AvailablePiecesTray.types";
import {
  TRAY_PIECE_IMAGE_PX,
  isForcedPlacement,
  piecePlacementCells,
  sortedRemainingPieces,
  trayRemainingCount,
} from "./useAvailablePiecesTrayDomain";

/**
 * The state tier of Phase 13's non-trivial split (requirements §7.2.1,
 * docs/CONVENTIONS.md): values derived from the magnified telescope's current
 * state via the pure domain tier. This component holds no local non-telescope UI
 * state of its own — the derived value is the column list, rebuilt when the tray
 * slice (its `game` or its hint flags) changes.
 */
export interface AvailablePiecesTrayStateInternal {
  readonly columns: readonly AvailablePiecesTrayColumn[];
}

export function useAvailablePiecesTrayState(
  props: Readonly<TelescopedProps<AvailablePiecesTrayState>>,
): AvailablePiecesTrayStateInternal {
  const columns = useMemo<AvailablePiecesTrayColumn[]>(
    () =>
      sortedRemainingPieces(props.state.game.availablePieces).map((piece) => ({
        piece,
        count: trayRemainingCount(props.state.game.availablePieces, piece),
        forcedPlacement: isForcedPlacement(props.state, piece),
        placements: piecePlacementCells(props.state, piece),
        pieceImage: {
          state: pieceImageState(piece),
          telescope: props.telescope.magnify(pieceImageLens(piece)),
        },
      })),
    // `props.state` is fresh on every tray-slice emission (the shell builds it),
    // so its identity tracks every field the derivation reads.
    [props.state, props.telescope],
  );

  return { columns };
}

/** `AvailablePiecesTrayState` → the piece-image slice one tray column renders. */
function pieceImageState(piece: Piece): PieceDisplayState {
  return { piece, size: TRAY_PIECE_IMAGE_PX };
}

/**
 * The magnification focusing the tray telescope down to the piece image of one
 * distinct piece value. Same deliberate asymmetry as the shell's board/tray
 * lenses: the piece value is an immutable domain value and the render size is a
 * tray-level layout constant, so no field of this slice can ever change — writes
 * through it return the parent slice unchanged (identity no-op) and the magnified
 * stream simply mirrors.
 */
function pieceImageLens(
  piece: Piece,
): Lens<AvailablePiecesTrayState, PieceDisplayState> {
  return new Lens(
    () => pieceImageState(piece),
    (_pieceImage, state) => state,
  );
}
