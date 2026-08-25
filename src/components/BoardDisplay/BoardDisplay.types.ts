import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { BoardCell, PieceType } from "../CellDisplay/CellDisplay.types";
import type { RowDisplayState } from "../RowDisplay/RowDisplay.types";
import type { CellFitCache } from "../../game/gameBuilder";

/** One board row as board-level data: its zero-based ordinal and its cells, in column order. */
export interface BoardRow {
  readonly index: number;
  readonly cells: readonly BoardCell[];
}

/**
 * The complete, self-describing state slice for the whole board (requirements §5.2):
 * a `size × size` grid with exactly one row object per board row, plus the
 * `pieceType` the cells forward to their droppable targets. Phase 12 (§5.2) also
 * carries the move engine's `cellToFitPieces` fit cache and the two hint preferences:
 * all three are board-wide invariants the rows/cells project down as read-only context,
 * so the §5.2 hints derive from the shared cache instead of recomputing fit legality.
 */
export interface BoardDisplayState {
  readonly size: number;
  readonly pieceType: PieceType;
  readonly rows: readonly BoardRow[];
  readonly cellToFitPieces: CellFitCache;
  readonly hintFitPieceCount: boolean;
  readonly showFitPiecesOnHover: boolean;
}

/** Everything `RenderBoardDisplay` needs, precomputed by `useBoardDisplayViewModel`. */
export interface BoardDisplayViewModel {
  readonly size: number;
  readonly rows: readonly TelescopedProps<RowDisplayState>[];
}
