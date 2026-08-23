import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { Piece } from "../../game/entities";
import type { Tray } from "../../game/gameBuilder";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";

/**
 * §5.5 — the complete, self-describing state slice for the available-pieces tray: the
 * current board size and the move engine's remaining-pieces map (the domain `Tray`:
 * one entry per distinct piece value, keyed to how many copies of that value are
 * still unplaced — §3.4/§3.5 step 3).
 */
export interface AvailablePiecesTrayState {
  readonly size: number;
  readonly availablePieces: Tray;
}

/**
 * One tray column in the view model: a distinct remaining piece value, how many copies
 * of it remain, and that column's piece image as its own magnified-telescope slice —
 * the §7.2 load-bearing parent→child flow, so `RenderAvailablePiecesTray` hands a
 * real `PieceDisplay` (Phase 6) to each column without re-deriving state.
 */
export interface AvailablePiecesTrayColumn {
  readonly piece: Piece;
  readonly count: number;
  readonly pieceImage: TelescopedProps<PieceDisplayState>;
}

/** Everything `RenderAvailablePiecesTray` needs, precomputed by `useAvailablePiecesTrayViewModel`. */
export interface AvailablePiecesTrayViewModel {
  /**
   * One column per distinct remaining piece value, ascending by base-10-encoded
   * value. The columns lay out in a full-board-width row that wraps only when the
   * next column would not fit.
   */
  readonly columns: readonly AvailablePiecesTrayColumn[];
}
