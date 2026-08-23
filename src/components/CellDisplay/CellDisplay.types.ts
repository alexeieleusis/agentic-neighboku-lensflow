import type { Piece } from "../../game/entities";

/**
 * The two visual skins for the shared attribute space (requirements §1, §5.4). Defined
 * here at the leaf of the Phase 5 component tree — `CellDisplay` is the first
 * consumer that *uses* it — with the parents (`RowDisplay`, `BoardDisplay`, and the
 * app shell) importing it bottom-up from here, which keeps the component type graph
 * acyclic.
 */
export type PieceType = "Shapes" | "Faces";

/**
 * One board cell's placement data: its zero-based position plus the piece occupying it
 * (or `null` for a blank cell). The shared cell shape behind the Board/Row/Cell
 * state slices of this phase.
 */
export interface BoardCell {
  readonly row: number;
  readonly col: number;
  readonly piece: Piece | null;
}

/**
 * The complete, self-describing state slice for one rendered cell (requirements §5.2).
 * `size`/`pieceType` ride along so the view model can derive its section coloring and
 * a `pieceType`-appropriate droppable target without the board prop-drilling them.
 */
export interface CellDisplayState {
  readonly size: number;
  readonly pieceType: PieceType;
  readonly row: number;
  readonly col: number;
  readonly piece: Piece | null;
}

/**
 * Everything `RenderCellDisplay` needs, precomputed by `useCellDisplayViewModel`.
 * `gridRow`/`gridColumn` are 1-indexed CSS grid lines (the board grid has exactly one
 * row and one column per board row/column, §5.2); `backgroundColor` is the section-
 * keyed fill (`gridRow`/`gridColumn`/`backgroundColor` named in the requirements as
 * `CellDisplay`'s view-model fields).
 */
export interface CellDisplayViewModel {
  readonly gridRow: number;
  readonly gridColumn: number;
  readonly backgroundColor: string;
  /** The placed piece — `null` for a blank cell showing only its droppable target. */
  readonly piece: Piece | null;
  /** Placeholder digits for the minimal inline piece representation; `null` when blank. */
  readonly pieceLabel: string | null;
  readonly pieceType: PieceType;
  /**
   * §5.6 droppable node ref: attached to the cell's root element to register it as the
   * `cell-{row}-{col}` drop target via `useDroppable`. Registration is live only while
   * the cell is blank — a filled cell is a no-op target (dropping there cannot be a
   * legal placement by the §3.5 rules).
   */
  readonly droppableNodeRef: (element: HTMLElement | null) => void;
  /** §5.6: `true` while a piece is being dragged over this cell's live drop target. */
  readonly isOver: boolean;
}
