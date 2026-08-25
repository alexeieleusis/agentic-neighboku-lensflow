import type { Piece } from "../../game/entities";
import type { CellFitCache } from "../../game/gameBuilder";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";

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
 * state slices.
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
 * Phase 12 adds the `cellToFitPieces` fit cache and the two §5.2 hint preferences:
 * all three are board-wide invariants that the board/row slices forward read-only
 * (the move engine is the cache's only writer, §3.4/§3.5; the preferences are
 * shell-wide, §4.2), so the cell's hint contents derive from the shared cache with no
 * local fit-legality recomputation.
 */
export interface CellDisplayState {
  readonly size: number;
  readonly pieceType: PieceType;
  readonly row: number;
  readonly col: number;
  readonly piece: Piece | null;
  /** Phase 12, §5.2 — the Phase 3 fit cache: blank cell's linear index → the tray pieces that would legally occupy it. */
  readonly cellToFitPieces: CellFitCache;
  /** Phase 12, §4.2/§5.2 — the `hintFitPieceCount` preference, forwarded read-only. */
  readonly hintFitPieceCount: boolean;
  /** Phase 12, §4.2/§5.2 — the `showFitPiecesOnHover` preference, forwarded read-only. */
  readonly showFitPiecesOnHover: boolean;
}

/**
 * Everything `RenderCellDisplay` needs, precomputed by `useCellDisplayViewModel`.
 * `gridRow`/`gridColumn` are 1-indexed CSS grid lines (the board grid has exactly one
 * row and one column per board row/column, §5.2); `backgroundColor` is the section-
 * keyed fill (`gridRow`/`gridColumn`/`backgroundColor` named in the requirements as
 * `CellDisplay`'s view-model fields).
 *
 * `isOver`, `fitCountVisible`, and `fitPiecesTooltipOpen` are independent derived
 * gates, not parallel states of one widget — a blank cell with both hint prefs on
 * shows the fit-count badge and the open tooltip at once, and a piece hovering the
 * cell is orthogonal to both — so they stay parallel booleans rather than a
 * discriminated union (UC13 “When Not to Use It”: independent simple flags).
 */
// eslint-disable-next-line lensflow/no-parallel-boolean-state-flags
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
  /** Phase 12, §5.2: how many tray pieces would legally occupy this cell (0 if filled). */
  readonly fitCount: number;
  /** Phase 12, §5.2: whether to paint the fit count in the cell (blank cell AND `hintFitPieceCount` on). */
  readonly fitCountVisible: boolean;
  /**
   * Phase 12, §5.2: whether the hover/tap fit-pieces tooltip is open — the cell has a
   * non-empty fit list, `showFitPiecesOnHover` is on, AND the pointer currently hovers
   * the cell or a tap has revealed it.
   */
  readonly fitPiecesTooltipOpen: boolean;
  /**
   * Phase 12, §5.2: one magnified piece-image slice per piece the tooltip lists (one
   * entry of this cell's fit list) — the §7.2 parent→child flow into the shared
   * `PieceDisplay`.
   */
  readonly fitPieceImages: readonly TelescopedProps<PieceDisplayState>[];
  /** Phase 12, §5.2 — the cell root's event handlers: desktop pointer enter/leave, tap. */
  readonly onCellMouseEnter: () => void;
  readonly onCellMouseLeave: () => void;
  readonly onCellTap: () => void;
}
