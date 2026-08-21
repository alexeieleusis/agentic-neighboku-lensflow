import type { TelescopedProps } from "../../base/TelescopeComponent";
import { sectionSize } from "../../game/boardBuilder";
import type {
  CellDisplayState,
  CellDisplayViewModel,
} from "./CellDisplay.types";

/**
 * Trivial tier (requirements §7.2.1): a simple leaf with no local UI state, no user
 * actions, and — yet — no dnd-kit hook registration keeps one flat view-model hook;
 * no Domain/State/Actions split. The Phase 8 droppable registration and the Phase 12
 * hint logic are what will make this cell stop being trivial.
 */
export function useCellDisplayViewModel(
  props: Readonly<TelescopedProps<CellDisplayState>>,
): CellDisplayViewModel {
  const { size, pieceType, row, col, piece } = props.state;

  return {
    gridRow: row + 1,
    gridColumn: col + 1,
    backgroundColor: sectionColor(row, col, size),
    piece,
    pieceLabel: piece === null ? null : piece.map(String).join(" "),
    pieceType,
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
