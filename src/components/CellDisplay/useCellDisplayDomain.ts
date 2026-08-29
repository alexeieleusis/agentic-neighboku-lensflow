import type { Piece } from "../../game/entities";
import { sectionSize } from "../../game/boardBuilder";
import type { Cell, CellFitCache } from "../../game/gameBuilder";
import { cellIndex } from "../../game/gameBuilder";

/**
 * §5.6/§5.2 — the pure tier of this cell's fractal split (requirements §7.2.1): no React,
 * no telescope imports. The highest-priority tier of the testing pyramid (requirements
 * §7.5) — see `__tests__/useCellDisplayDomain.test.ts`.
 *
 * Owns the droppable-id convention (`cell-{row}-{col}`) — shared with the shell's
 * drag-end monitor, which needs the inverse parse — and, since Phase 12 (§5.2), every
 * blank-cell hint derivation: the fit-piece count and the fit-piece list read straight
 * off the Phase 3 `cellToFitPieces` cache, plus the "is this hint shown here?" gates.
 * Nothing in this file recomputes fit legality: the move engine keeps the cache in
 * sync on every mutation (§3.4/§3.5), and these functions only project it.
 */

/**
 * The §5.6 droppable id of the cell at `(row, col)` — 0-indexed, the same row/column
 * addressing every other board-level structure in this build uses.
 */
export function cellDroppableId(row: number, col: number): string {
  return `cell-${row}-${col}`;
}

/**
 * Inverse of {@link cellDroppableId}: parse `cell-{row}-{col}` back into a `Cell`.
 * Returns `null` for anything that is not exactly the §5.6 cell shape, so the
 * drag-end monitor treats a non-cell drop target as a no-op instead of a crash.
 */
export function cellFromDroppableId(id: string): Cell | null {
  const match = /^cell-(\d+)-(\d+)$/.exec(id);
  if (match === null) return null;
  return [Number(match[1]), Number(match[2])];
}

/* ------------------------------------------------------------------ */
/* Phase 12 — §5.2 hint derivations                                    */
/* ------------------------------------------------------------------ */

/**
 * Pixel edge the shared Phase 6 `PieceDisplay` renders each fit piece at inside this
 * cell's §5.2 hover/tap tooltip. A rebuild layout choice; the tray's equivalent is
 * `TRAY_PIECE_IMAGE_PX` (`useAvailablePiecesTrayDomain.ts`).
 */
export const FIT_PIECE_IMAGE_PX = 32;

/**
 * The pixel edge the filled cell's piece-image slice declares. The cell does not
 * render the piece at this fixed edge: `CellDisplay` stretches the piece to fill the
 * cell's interior (see `CELL_PIECE_INSET_PX`), so this edge only acts as the rendered
 * element's intrinsic/fallback size should the CSS fill ever fail to resolve.
 */
export const CELL_PIECE_IMAGE_PX = 32;

/**
 * Total pixel inset the filled cell's piece keeps inside the cell: the piece box is
 * `calc(100% - CELL_PIECE_INSET_PX px)` of the cell's content box, leaving
 * `CELL_PIECE_INSET_PX / 2` px of padding per side on top of the cell's own 1px
 * border. A fixed pixel edge (rather than this relative fill) would make the piece
 * a sliver on small boards and a lost-in-space thumbnail on large ones, because the
 * cell edge is a function of board size and viewport (a 3×3 cell is roughly six
 * times a 12×12 cell at the shell's bounded width).
 */
export const CELL_PIECE_INSET_PX = 4;

/**
 * §5.2: the tray pieces that would legally occupy `(row, col)`, read from the Phase 3
 * `cellToFitPieces` cache at the cell's linear index. The cache is keyed over blank
 * cells only (§3.5 step 5), so a filled cell — and any entry-less index — yields the
 * empty list; a blank cell whose entry is the empty array (an unsolvable position,
 * §3.6) does too.
 */
export function fitPiecesForCell(
  cellToFitPieces: CellFitCache,
  size: number,
  row: number,
  col: number,
): readonly Piece[] {
  return cellToFitPieces.get(cellIndex(size, row, col)) ?? [];
}

/** §5.2: how many pieces would legally occupy that cell (the fit list's length). */
export function fitPieceCountForCell(
  cellToFitPieces: CellFitCache,
  size: number,
  row: number,
  col: number,
): number {
  return fitPiecesForCell(cellToFitPieces, size, row, col).length;
}

/**
 * §5.2 rule 1: the fit-count hint shows on a blank cell iff `hintFitPieceCount` is on
 * — a filled cell never shows a count, regardless of the preference. A blank cell with
 * zero fitting pieces still shows "0": in a solvable position every blank cell has at
 * least one fit, so the 0 is itself the signal that the position has gone unsolvable.
 */
export function fitCountHintIsOn(
  piece: Piece | null,
  hintFitPieceCount: boolean,
): boolean {
  return piece === null && hintFitPieceCount;
}

/**
 * §5.2 rule 2: the hover/tap fit-pieces tooltip is offered on a blank cell iff
 * `showFitPiecesOnHover` is on AND there is at least one piece to list — a blank cell
 * with an empty fit list renders no tooltip rather than an empty box (its "0" count
 * already carries the same information).
 */
export function fitPiecesTooltipIsOn(
  piece: Piece | null,
  showFitPiecesOnHover: boolean,
  fitCount: number,
): boolean {
  return piece === null && showFitPiecesOnHover && fitCount > 0;
}

/* ------------------------------------------------------------------ */
/* §5.2 cell geometry & placeholder (moved from the flat view model    */
/* when Phase 12 split `useCellDisplayViewModel`)                       */
/* ------------------------------------------------------------------ */

/** §5.2: the 0-indexed board line → the 1-indexed CSS grid line the cell positions on. */
export function cssGridLine(index: number): number {
  return index + 1;
}

/**
 * The section-keyed background color (requirements §5.2 — the exact values are a free
 * styling decision). Section membership is the §3.3 tiling: a `size` board is
 * `sectionSize × sectionSize` sub-grids, so `(row, col)` sits in the sub-grid
 * `floor(row/sSize), floor(col/sSize)`. The hue spreads the board's sections around
 * the color wheel and the lightness alternates between adjacent sections, so
 * neighboring sections stay distinguishable even when the hue step gets small (the
 * 12×12 board's 16 sections are ~22.5° apart in hue).
 */
export function sectionColorFor(
  row: number,
  col: number,
  size: number,
): string {
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
