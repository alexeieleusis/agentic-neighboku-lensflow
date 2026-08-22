import { useMemo } from "react";
import { Lens } from "telescopejs";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type {
  BoardCell,
  CellDisplayState,
} from "../CellDisplay/CellDisplay.types";
import type { RowDisplayState, RowDisplayViewModel } from "./RowDisplay.types";

/**
 * Trivial tier (requirements §7.2.1): a row is a pure grouping element in this phase —
 * no local UI state, no user actions, no dnd-kit hook registration — so it keeps one
 * flat view-model hook whose only job is to hand each of its cells a magnified
 * telescope (the load-bearing parent→child convention, §7.2).
 */
export function useRowDisplayViewModel(
  props: Readonly<TelescopedProps<RowDisplayState>>,
): RowDisplayViewModel {
  const cells = useMemo(
    () =>
      props.state.cells.map((cell) => ({
        state: cellDisplayState(cell, props.state),
        telescope: props.telescope.magnify(cellLens(cell.col)),
      })),
    [props.state, props.telescope],
  );

  return { cells };
}

/** `RowDisplayState` → the state slice for the single cell at `cell`'s column. */
function cellDisplayState(
  cell: BoardCell,
  row: RowDisplayState,
): CellDisplayState {
  return {
    size: row.size,
    pieceType: row.pieceType,
    row: row.rowIndex,
    col: cell.col,
    piece: cell.piece,
  };
}

/**
 * The magnification focusing a row telescope down to the cell at `col`.
 *
 * Intentional asymmetry: `get` exposes the full `CellDisplayState` (board-level
 * invariants `size`/`pieceType` plus the fixed `row`/`col` position, all
 * forwarded as read-only context to the cell), but `set` writes back only
 * `piece` — the sole cell-local mutable field. `size`/`pieceType` are
 * board-wide and cannot be changed per-cell.
 */
export function cellLens(col: number): Lens<RowDisplayState, CellDisplayState> {
  return new Lens(
    (row) => cellDisplayState(row.cells[col], row),
    (cell, row) => ({
      ...row,
      cells: row.cells.map((c, i) =>
        i === col ? { ...c, piece: cell.piece } : c,
      ),
    }),
  );
}
