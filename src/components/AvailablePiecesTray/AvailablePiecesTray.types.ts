import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { Piece } from "../../game/entities";
import type { Cell, Game } from "../../game/gameBuilder";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";

/**
 * §5.5 — the complete, self-describing state slice for the available-pieces tray: the
 * move engine's `Game` in its entirety, plus the two tray-scoped §4.2 hint flags
 * (mirror-image of `AppPreferences.hints.availablePieceUniqueCell` / `.pieceCells`).
 * The slice carries the whole `Game` (not a picked few of its fields) for two reasons:
 * the render path reads three of its fields (`size`, `availablePieces`,
 * `pieceToFitCells` — §5.5's two hint bullets), and the commit path — Phase 13's
 * click-to-place — hands the piece and the clicked cell to Phase 3's `placePiece`,
 * which needs the entire `Game` to produce the next one. A partial slice would force
 * the commit to parallel the engine's bookkeeping; the whole game does not.
 */
export interface AvailablePiecesTrayState {
  readonly game: Game;
  /** §4.2 `hintAvailablePieceUniqueCell` (this repo's naming): the `*` hint. */
  readonly availablePieceUniqueCell: boolean;
  /** §4.2 `hintPieceCells` (this repo's naming): the click-to-place cell list. */
  readonly pieceCells: boolean;
}

/**
 * §5.5 third bullet — one click-to-place target for a piece value: a legal fit-cell
 * (from `pieceToFitCells`) and its displayed 1-indexed `row,column` label (cell
 * `(0,0)` is labeled `1,1`). The label is a pure function of the cell
 * (`placementCellLabel`, `useAvailablePiecesTrayDomain.ts`).
 */
export interface TrayPlacementCell {
  readonly cell: Cell;
  readonly label: string;
}

/**
 * One tray column in the view model: a distinct remaining piece value, how many copies
 * of it remain, the §5.5 second-bullet `*` decision, the §5.5 third-bullet button list
 * (empty when the `pieceCells` hint is off), and that column's piece image as its own
 * magnified-telescope slice — the §7.2 load-bearing parent→child flow. The slice's shape
 * is `PieceDisplayState` (the image itself) and is handed to the column's
 * `DraggablePiece` (Phase 8), which renders the shared `PieceDisplay` (Phase 6) as its
 * `useDraggable` node without re-deriving any state.
 */
export interface AvailablePiecesTrayColumn {
  readonly piece: Piece;
  readonly count: number;
  /** §5.5 second bullet: `true` exactly when a literal `*` is appended to the count. */
  readonly forcedPlacement: boolean;
  /** §5.5 third bullet: one entry per legal fit-cell; `[]` when the hint is off. */
  readonly placements: readonly TrayPlacementCell[];
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
  /**
   * §5.5 third bullet — the shared click-to-place commit handler of every column
   * button: curries `placeTrayPiece` (the domain's delegation to Phase 3's
   * `placePiece`) with the current slice and commits through the tray telescope.
   */
  readonly onPlacePiece: (piece: Piece, cell: Cell) => void;
}
