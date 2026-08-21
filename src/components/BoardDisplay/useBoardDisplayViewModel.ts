import { useMemo } from "react";
import { Lens } from "telescopejs";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { RowDisplayState } from "../RowDisplay/RowDisplay.types";
import type {
  BoardDisplayState,
  BoardDisplayViewModel,
  BoardRow,
} from "./BoardDisplay.types";

/**
 * Trivial tier (requirements §7.2.1): a board is a pure grouping element in this
 * phase — no local UI state, no user actions, no dnd-kit hook registration (the §5.6
 * wiring lands in Phase 8, in the shell's `DndContext` descendant) — so it keeps one
 * flat view-model hook whose only job is to hand each of its rows a magnified
 * telescope (the load-bearing parent→child convention, §7.2).
 */
export function useBoardDisplayViewModel(
  props: Readonly<TelescopedProps<BoardDisplayState>>,
): BoardDisplayViewModel {
  const rows = useMemo(
    () =>
      props.state.rows.map((row) => ({
        state: rowDisplayState(row, props.state),
        telescope: props.telescope.magnify(rowLens(row.index)),
      })),
    [props.state, props.telescope],
  );

  return { size: props.state.size, rows };
}

/** `BoardDisplayState` → the state slice for the single board row at `row`. */
function rowDisplayState(
  row: BoardRow,
  board: BoardDisplayState,
): RowDisplayState {
  return {
    size: board.size,
    pieceType: board.pieceType,
    rowIndex: row.index,
    cells: row.cells,
  };
}

/** The magnification focusing a board telescope down to the row at `index`. */
function rowLens(index: number): Lens<BoardDisplayState, RowDisplayState> {
  return new Lens(
    (board) => rowDisplayState(board.rows[index], board),
    (row, board) => ({
      ...board,
      rows: board.rows.map((r, i) =>
        i === index ? { ...r, cells: row.cells } : r,
      ),
    }),
  );
}
