import { useDroppable } from "@dnd-kit/core";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import { sectionSize } from "../../game/boardBuilder";
import type {
  CellDisplayState,
  CellDisplayViewModel,
} from "./CellDisplay.types";
import { cellDroppableId } from "./useCellDisplayDomain";

/**
 * Split tier (requirements §7.2.1): Phase 8's droppable registration made this cell
 * more than a trivial leaf — the pure id convention it shares with the shell's drag-end
 * monitor lives in `useCellDisplayDomain`. There is still no local UI state and no
 * action (the drop itself is committed centrally by the shell's `handleDragEnd`,
 * §5.6), so the split stays Domain + this orchestrator.
 */
export function useCellDisplayViewModel(
  props: Readonly<TelescopedProps<CellDisplayState>>,
): CellDisplayViewModel {
  const { size, pieceType, row, col, piece } = props.state;

  // The §5.6 droppable registration: id `cell-{row}-{col}`, live only while the cell is
  // blank. `useDroppable` registers with the nearest ANCESTOR DndContext via React
  // context (docs/CONVENTIONS.md dnd-kit note) — this cell always has one: the
  // shell-level `<DndContext>` that `App` constructs.
  const droppable = useDroppable({
    id: cellDroppableId(row, col),
    disabled: piece !== null,
  });

  return {
    gridRow: row + 1,
    gridColumn: col + 1,
    backgroundColor: sectionColor(row, col, size),
    piece,
    pieceLabel: piece === null ? null : piece.map(String).join(" "),
    pieceType,
    droppableNodeRef: droppable.setNodeRef,
    isOver: piece === null && droppable.isOver,
  };
}

/**
 * The section-keyed background color (requirements §5.2 — the exact values are a free
 * styling decision). Section membership is the §3.3 tiling: a `size` board is
 * `sectionSize × sectionSize` sub-grids, so `(row, col)` sits in the sub-grid
 * `floor(row/sSize), floor(col/sSize)`. The hue spreads the board's sections around
 * the color wheel and the lightness alternates between adjacent sections, so
 * neighboring sections stay distinguishable even when the hue step gets small (a
 * 16×16 board's 64 sections are only ~5.6° apart in hue).
 */
function sectionColor(row: number, col: number, size: number): string {
  const sSize = sectionSize(size);
  const sectionsPerAxis = size / sSize;
  const sectionRow = Math.floor(row / sSize);
  const sectionCol = Math.floor(col / sSize);
  const totalSections = sectionsPerAxis * sectionsPerAxis;
  const hue = Math.round(
    ((sectionRow * sectionsPerAxis + sectionCol) * 360) / totalSections,
  );
  const lightness = (sectionRow + sectionCol) % 2 === 0 ? 30 : 20;
  return `hsl(${hue}, 50%, ${lightness}%)`;
}
