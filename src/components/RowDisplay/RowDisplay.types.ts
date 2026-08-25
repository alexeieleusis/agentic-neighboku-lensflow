import type { TelescopedProps } from "../../base/TelescopeComponent";
import type {
  BoardCell,
  CellDisplayState,
  PieceType,
} from "../CellDisplay/CellDisplay.types";
import type { CellFitCache } from "../../game/gameBuilder";

/**
 * The complete, self-describing state slice for one board row (requirements §5.2):
 * the row's cells in left-to-right order, plus the board-level facts (`size`,
 * `pieceType`, and — since Phase 12 — the `cellToFitPieces` cache and the two
 * hint preferences) that each of its cells needs.
 */
export interface RowDisplayState {
  readonly size: number;
  readonly pieceType: PieceType;
  readonly rowIndex: number;
  readonly cells: readonly BoardCell[];
  readonly cellToFitPieces: CellFitCache;
  readonly hintFitPieceCount: boolean;
  readonly showFitPiecesOnHover: boolean;
}

/** Everything `RenderRowDisplay` needs, precomputed by `useRowDisplayViewModel`. */
export interface RowDisplayViewModel {
  readonly cells: readonly TelescopedProps<CellDisplayState>[];
}
