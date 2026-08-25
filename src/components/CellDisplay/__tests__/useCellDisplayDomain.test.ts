import { describe, expect, it } from "vitest";
import { createPiece, type Piece } from "../../../game/entities";
import type { CellFitCache } from "../../../game/gameBuilder";
import { cellIndex } from "../../../game/gameBuilder";
import {
  cellDroppableId,
  cellFromDroppableId,
  cssGridLine,
  fitCountHintIsOn,
  fitPieceCountForCell,
  fitPiecesForCell,
  fitPiecesTooltipIsOn,
  pieceLabelFor,
  sectionColorFor,
} from "../useCellDisplayDomain";

const cellIdTests = [
  {
    name: "encodes (row, col) as `cell-{row}-{col}` (0-indexed board addressing)",
    run: () => {
      expect(cellDroppableId(0, 0)).toBe("cell-0-0");
      expect(cellDroppableId(1, 2)).toBe("cell-1-2");
      expect(cellDroppableId(15, 0)).toBe("cell-15-0");
    },
  },
  {
    name: "round-trips through the inverse parse",
    run: () => {
      for (const row of [0, 1, 5]) {
        for (const col of [0, 3, 8]) {
          expect(cellFromDroppableId(cellDroppableId(row, col))).toEqual([
            row,
            col,
          ]);
        }
      }
    },
  },
];

const UNPARSEABLE_IDS = [
  "cell-1", // missing column
  "cell-1-2-3", // trailing garbage
  "cell-a-b", // non-numeric
  "cell--1-2", // negative
  "cell-1-2x", // trailing junk
  "cell", // no coordinates at all
  "piece-0-0", // a tray-piece id, not a cell id
  "",
];

describe("CellDisplay domain (§5.6 droppable ids)", () => {
  for (const tc of cellIdTests) it(tc.name, tc.run);

  it("rejects ids that are not the `cell-{row}-{col}` shape", () => {
    for (const id of UNPARSEABLE_IDS) {
      expect(cellFromDroppableId(id)).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ */
/* Phase 12 — §5.2 hint derivations                                    */
/* ------------------------------------------------------------------ */

const SIZE = 6;

describe("CellDisplay domain (Phase 12 §5.2 — fit hints from the fit cache)", () => {
  const pieceA = createPiece([0, 1, 2], 3, 3);
  const pieceB = createPiece([1, 2, 0], 3, 3);
  const pieceC = createPiece([2, 0, 1], 3, 3);
  const cellA = cellIndex(SIZE, 2, 3);
  const cellB = cellIndex(SIZE, 4, 0);
  const deadCell = cellIndex(SIZE, 0, 0);

  // Shapes the `cellToFitPieces` cache the move engine builds (§3.5 step 5): blank
  // cell linear index → the tray pieces that would legally occupy it. `cellA` fits
  // three pieces, `cellB` one, `deadCell` none, cell (5,5) is filled (no entry).
  const fitCache: CellFitCache = new Map([
    [cellA, [pieceA, pieceB, pieceC] as readonly Piece[]],
    [cellB, [pieceA] as readonly Piece[]],
    [deadCell, [] as readonly Piece[]],
  ]);

  it("lists every piece the cache says would fit the cell", () => {
    expect(fitPiecesForCell(fitCache, SIZE, 2, 3)).toEqual([
      pieceA,
      pieceB,
      pieceC,
    ]);
    expect(fitPiecesForCell(fitCache, SIZE, 4, 0)).toEqual([pieceA]);
  });

  it("returns no pieces for a filled cell (no cache entry) or an empty entry", () => {
    expect(fitPiecesForCell(fitCache, SIZE, 5, 5)).toEqual([]);
    expect(fitPiecesForCell(fitCache, SIZE, 0, 0)).toEqual([]);
  });

  it("counts the pieces that would fit the cell", () => {
    expect(fitPieceCountForCell(fitCache, SIZE, 2, 3)).toBe(3);
    expect(fitPieceCountForCell(fitCache, SIZE, 4, 0)).toBe(1);
    expect(fitPieceCountForCell(fitCache, SIZE, 0, 0)).toBe(0);
    expect(fitPieceCountForCell(fitCache, SIZE, 5, 5)).toBe(0);
  });

  it("shows the fit count only on a blank cell when hintFitPieceCount is on", () => {
    expect(fitCountHintIsOn(null, true)).toBe(true);
    expect(fitCountHintIsOn(null, false)).toBe(false);
    expect(fitCountHintIsOn(pieceA, true)).toBe(false);
    expect(fitCountHintIsOn(pieceA, false)).toBe(false);
  });

  it("offers the hover/tap tooltip only on a blank cell, when the preference is on, and when something would fit", () => {
    expect(fitPiecesTooltipIsOn(null, true, 3)).toBe(true);
    expect(fitPiecesTooltipIsOn(null, false, 3)).toBe(false);
    expect(fitPiecesTooltipIsOn(null, true, 0)).toBe(false);
    expect(fitPiecesTooltipIsOn(pieceA, true, 3)).toBe(false);
    expect(fitPiecesTooltipIsOn(pieceA, true, 0)).toBe(false);
  });
});

describe("CellDisplay domain (moved view-model helpers)", () => {
  it("cssGridLine is the 1-indexed CSS grid line for a 0-indexed board line", () => {
    expect(cssGridLine(0)).toBe(1);
    expect(cssGridLine(5)).toBe(6);
    expect(cssGridLine(15)).toBe(16);
  });

  it("pieceLabelFor joins the digits with spaces, null for a blank cell", () => {
    expect(pieceLabelFor(null)).toBeNull();
    expect(pieceLabelFor(createPiece([1, 2, 0], 3, 3))).toBe("1 2 0");
    expect(pieceLabelFor(createPiece([0], 1, 3))).toBe("0");
  });

  it("sectionColorFor is stable within a section and distinct across sections", () => {
    // 6×6 → section size 3: cells (0,0) and (2,2) share section (0,0); (3,0) is in
    // section row 1.
    expect(sectionColorFor(0, 0, SIZE)).toBe(sectionColorFor(2, 2, SIZE));
    expect(sectionColorFor(0, 0, SIZE)).not.toBe(sectionColorFor(3, 0, SIZE));
    expect(sectionColorFor(0, 0, SIZE)).toMatch(/^hsl\(\d+, 50%, (20|30)%\)$/);
  });
});
