import type { AppState } from "./App.types.ts";
import type { AvailablePiecesTrayState } from "./components/AvailablePiecesTray/AvailablePiecesTray.types.ts";
import type {
  BoardDisplayState,
  BoardRow,
} from "./components/BoardDisplay/BoardDisplay.types.ts";
import type {
  BoardCell,
  PieceType,
} from "./components/CellDisplay/CellDisplay.types.ts";
import { cellFromDroppableId } from "./components/CellDisplay/useCellDisplayDomain.ts";
import { pieceFromDraggableId } from "./components/DraggablePiece/useDraggablePieceDomain.ts";
import type { Piece } from "./game/entities";
import { isSamePiece } from "./game/entities";
import { placePiece } from "./game/gameBuilder.ts";
import type { Game } from "./game/gameBuilder.ts";

/**
 * §5.6 / Phase 8 — the shell's pure tier (requirements §7.2.1): no React, no telescope
 * imports. Holds the board/tray state-slice derivations (moved here from `App.tsx` when
 * the shell's hook split landed) and the drag-drop resolution: current state plus the
 * two ids a drag-end event carries in, next state out.
 */

/**
 * Flatten a frozen `Board` into Phase 5's `BoardDisplayState`: one `BoardRow` per
 * board row, cells in column order, plus the app-level `pieceType` the shell owns
 * (requirements §4.2) that cells forward to their droppable targets.
 */
export function buildBoardDisplayState(
  game: Game,
  pieceType: PieceType,
): BoardDisplayState {
  const rows: BoardRow[] = [];
  for (let row = 0; row < game.size; row++) {
    const cells: BoardCell[] = [];
    for (let col = 0; col < game.size; col++) {
      cells.push({ row, col, piece: game.board[row][col] });
    }
    rows.push({ index: row, cells });
  }
  return { size: game.size, pieceType, rows };
}

/**
 * The remaining tray slice the `AvailablePiecesTray` renders (§5.5): the board size
 * plus the move engine's remaining pieces, one entry per distinct piece value.
 */
export function buildAvailablePiecesTrayState(
  game: Game,
): AvailablePiecesTrayState {
  return {
    size: game.size,
    availablePieces: game.availablePieces,
  };
}

/**
 * The two dnd-kit ids a drag-end event carries, reduced to plain strings: the id the
 * shell registered the dragged tray piece under (`DraggablePiece`'s `useDraggable`
 * encoding, `useDraggablePieceDomain.ts`) and the id of the droppable the pointer
 * released over (`CellDisplay`'s `useDroppable` cell id, `useCellDisplayDomain.ts`;
 * `null` when the pointer is not over any registered droppable).
 */
export interface DragDropEventIds {
  readonly activeId: string;
  readonly overId: string | null;
}

/**
 * §5.6: the shared drop path. Reads the dropped piece's value and the target cell off
 * the drag event's ids and commits through `placePiece` — the same move-engine call
 * Phase 13's click-to-place will use. Every non-placement outcome returns the input
 * state unchanged (same reference, so no stream re-emission):
 *   - dropped outside any droppable (`overId` is `null`) → no-op;
 *   - an id that does not parse as a cell / a tray piece / a held tray value → no-op;
 *   - an illegal placement with `preventInvalidMoves` (the default, §4.2) →
 *     `placePiece` throws (§3.5 step 2, before touching any state) and the throw is
 *     absorbed here — no partial mutation. Surfacing the rejection (the Snackbar
 *     opening) is Phase 11's concern; this path must simply not crash the app.
 */
export function resolveDragDrop(
  state: AppState,
  event: Readonly<DragDropEventIds>,
): AppState {
  if (event.overId === null) return state;
  const cell = cellFromDroppableId(event.overId);
  if (cell === null) return state;
  const piece = resolveTrayPiece(
    state.game,
    pieceFromDraggableId(event.activeId),
  );
  if (piece === null) return state;
  try {
    return { ...state, game: placePiece(piece, cell, state.game) };
  } catch {
    return state;
  }
}

/**
 * The tray's interned `Piece` reference whose digits are `digits` (`null` when the tray
 * holds no such value). `placePiece`'s `Map` lookups are by reference (§8.7), so a
 * freshly-parsed digit array must be resolved back to the tray's own key before it can
 * drive a placement — this is that resolution.
 */
export function resolveTrayPiece(
  game: Game,
  digits: readonly number[] | null,
): Piece | null {
  if (digits === null) return null;
  for (const piece of game.availablePieces.keys()) {
    if (isSamePiece(piece, digits)) return piece;
  }
  return null;
}
