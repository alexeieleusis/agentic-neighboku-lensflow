import { describe, expect, it } from "vitest";
import { createPiece, type Piece } from "../../../game/entities";
import {
  cellFromIndex,
  cellIndex,
  unfoldGame,
  type Cell,
  type Game,
  type Move,
  type PieceFitCache,
  type Tray,
} from "../../../game/gameBuilder";
import type { Board } from "../../../game/boardBuilder";
import { buildBoard } from "../../../game/boardBuilder";
import {
  TRAY_PIECE_IMAGE_PX,
  isForcedPlacement,
  pieceBase10Value,
  piecePlacementCells,
  placementCellLabel,
  placeTrayPiece,
  sortedRemainingPieces,
  trayRemainingCount,
} from "../useAvailablePiecesTrayDomain";
import type { AvailablePiecesTrayState } from "../AvailablePiecesTray.types";

function trayOf(
  entries: ReadonlyArray<readonly [readonly number[], number]>,
): Tray {
  const tray = new Map<Piece, number>();
  for (const [digits, count] of entries) {
    tray.set(createPiece(digits, 3, 3), count);
  }
  return tray;
}

describe("pieceBase10Value (§5.5 sort key)", () => {
  it("reads the attribute digits as decimal digits, most significant first", () => {
    expect(pieceBase10Value(createPiece([0, 0, 0], 3, 3))).toBe(0);
    expect(pieceBase10Value(createPiece([0, 2, 0], 3, 3))).toBe(20);
    expect(pieceBase10Value(createPiece([1, 0, 0], 3, 3))).toBe(100);
    expect(pieceBase10Value(createPiece([1, 1, 1], 3, 3))).toBe(111);
    expect(pieceBase10Value(createPiece([2, 1, 0], 3, 3))).toBe(210);
  });

  it("handles 2-dimensional pieces (their digit is simply shorter)", () => {
    expect(pieceBase10Value(createPiece([1, 2], 2, 3))).toBe(12);
  });
});

describe("sortedRemainingPieces (§5.5 first bullet)", () => {
  it("orders values ascending by base-10-encoded value regardless of map order", () => {
    const tray = trayOf([
      [[2, 1, 0], 1],
      [[0, 0, 0], 2],
      [[1, 1, 1], 1],
      [[0, 2, 0], 3],
      [[1, 0, 0], 4],
    ]);
    expect(sortedRemainingPieces(tray)).toEqual([
      createPiece([0, 0, 0], 3, 3),
      createPiece([0, 2, 0], 3, 3),
      createPiece([1, 0, 0], 3, 3),
      createPiece([1, 1, 1], 3, 3),
      createPiece([2, 1, 0], 3, 3),
    ]);
  });

  it("excludes values whose remaining count is zero", () => {
    const tray = trayOf([
      [[0, 0, 0], 0],
      [[1, 1, 1], 2],
    ]);
    expect(sortedRemainingPieces(tray)).toEqual([createPiece([1, 1, 1], 3, 3)]);
  });

  it("returns an empty array for an empty tray", () => {
    expect(sortedRemainingPieces(trayOf([]))).toEqual([]);
  });

  it("does not mutate the input tray", () => {
    const tray = trayOf([
      [[2, 0, 0], 1],
      [[0, 0, 0], 1],
    ]);
    const before = [...tray];
    sortedRemainingPieces(tray);
    expect([...tray]).toEqual(before);
  });

  it("throws when the remaining tray mixes attribute lengths (the base-10 key is only order-preserving within one digit length)", () => {
    // [2] (base-10 = 2) collides with [0, 2] (base-10 = 2) and misorders against
    // [1, 0] (base-10 = 10); a mixed-length tray has no stable "ascending" order,
    // so the guard turns it into a contract violation instead of a silent mis-sort.
    const tray = new Map<Piece, number>([
      [createPiece([2], 1, 3), 1],
      [createPiece([1, 0], 2, 3), 1],
      [createPiece([0, 2], 2, 3), 1],
    ]);
    expect(() => sortedRemainingPieces(tray)).toThrow(RangeError);
  });

  it("does not trip the dimension guard for a zero-count piece of a different length", () => {
    const tray = new Map<Piece, number>([
      [createPiece([0, 0, 0], 3, 3), 1],
      [createPiece([1, 2], 2, 3), 0],
    ]);
    expect(sortedRemainingPieces(tray)).toEqual([createPiece([0, 0, 0], 3, 3)]);
  });
});

describe("trayRemainingCount (§5.5 second bullet)", () => {
  it("reads the remaining count for a present value", () => {
    // Tray maps are keyed by piece reference (§8.7), so the lookup reuses the exact
    // `Piece` instances the map was built with.
    const pieceA = createPiece([0, 2, 0], 3, 3);
    const pieceB = createPiece([1, 0, 0], 3, 3);
    const tray = new Map<Piece, number>([
      [pieceA, 3],
      [pieceB, 1],
    ]);
    expect(trayRemainingCount(tray, pieceA)).toBe(3);
    expect(trayRemainingCount(tray, pieceB)).toBe(1);
  });

  it("is 0 for a value that is fully placed (absent from the tray)", () => {
    const tray = trayOf([[[0, 2, 0], 1]]);
    expect(trayRemainingCount(tray, createPiece([2, 2, 2], 3, 3))).toBe(0);
  });
});

describe("layout constants", () => {
  it("exposes the tray piece-image pixel edge used by the view model", () => {
    expect(TRAY_PIECE_IMAGE_PX).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Phase 13 — the hint comparisons and the click-to-place commit               */
/* -------------------------------------------------------------------------- */

/**
 * A stand-in `Game` for the read-only comparison functions: the tray domain never
 * indexes `board` (the render path reads `availablePieces` + `pieceToFitCells`
 * only), so an empty stand-in board is sufficient here — the `placeTrayPiece`
 * tests below use a real, freshly-unfolded game instead, because `placePiece`
 * does index the board.
 */
const EMPTY_BOARD: Board = [];
const NO_MOVES: readonly Move[] = [];

function readGame(
  size: number,
  tray: Tray,
  pieceToFitCells: PieceFitCache,
): Game {
  return {
    size,
    board: EMPTY_BOARD,
    availablePieces: tray,
    placedCells: NO_MOVES,
    pieceToFitCells,
    cellToFitPieces: new Map<number, Piece[]>(),
    preferences: { preventInvalidMoves: true },
  };
}

function trayState(
  game: Game,
  availablePieceUniqueCell = false,
  pieceCells = false,
): AvailablePiecesTrayState {
  return { game, availablePieceUniqueCell, pieceCells };
}

/** A guaranteed-legal (piece, blank cell) pair, read off the fit cache. */
function pickLegalPlacement(game: Game): readonly [Piece, Cell] {
  for (const [piece, cells] of game.pieceToFitCells) {
    if (cells.length > 0) {
      return [piece, cellFromIndex(game.size, cells[0])];
    }
  }
  throw new Error("fixture: unfolded game has no legal placement (impossible)");
}

describe("isForcedPlacement (§5.5 second bullet)", () => {
  // [0,2,0] ×2 remaining, exactly two legal fit-cells → forced; [1,0,0] ×1
  // remaining, two fit-cells → not; [0,0,0] ×1 remaining, absent from the cache
  // (zero fit-cells) → not.
  const pieceA = createPiece([0, 2, 0], 3, 3);
  const pieceB = createPiece([1, 0, 0], 3, 3);
  const pieceC = createPiece([0, 0, 0], 3, 3);
  const game = readGame(
    6,
    new Map<Piece, number>([
      [pieceA, 2],
      [pieceB, 1],
      [pieceC, 1],
    ]),
    new Map<Piece, number[]>([
      [pieceA, [0, 1]],
      [pieceB, [3, 4]],
    ]),
  );
  const hintOn = trayState(game, true);
  const hintOff = trayState(game, false);

  it("is true exactly when the hint is on and the fit-cell count equals the remaining count", () => {
    expect(isForcedPlacement(hintOn, pieceA)).toBe(true);
    expect(isForcedPlacement(hintOn, pieceB)).toBe(false);
    expect(isForcedPlacement(hintOn, pieceC)).toBe(false);
  });

  it("is false whenever the hint is off, regardless of the comparison", () => {
    expect(isForcedPlacement(hintOff, pieceA)).toBe(false);
    expect(isForcedPlacement(hintOff, pieceB)).toBe(false);
    expect(isForcedPlacement(hintOff, pieceC)).toBe(false);
  });
});

describe("placementCellLabel (§5.5 third bullet)", () => {
  it("is the 1-indexed row,column of the cell", () => {
    expect(placementCellLabel([0, 0])).toBe("1,1");
    expect(placementCellLabel([2, 5])).toBe("3,6");
    expect(placementCellLabel([5, 5])).toBe("6,6");
  });
});

describe("piecePlacementCells (§5.5 third bullet)", () => {
  const pieceA = createPiece([0, 2, 0], 3, 3);
  const pieceB = createPiece([1, 0, 0], 3, 3);
  // Size 6: index 0 → (0,0), 6 → (1,0), 7 → (1,1), 30 → (5,0).
  const game = readGame(
    6,
    new Map<Piece, number>([
      [pieceA, 2],
      [pieceB, 1],
    ]),
    new Map<Piece, number[]>([
      [pieceA, [0, 6, 7]],
      [pieceB, [30]],
    ]),
  );

  it("is one { cell, label } per legal fit-cell, in the cache's order", () => {
    expect(piecePlacementCells(trayState(game, false, true), pieceA)).toEqual([
      { cell: [0, 0], label: "1,1" },
      { cell: [1, 0], label: "2,1" },
      { cell: [1, 1], label: "2,2" },
    ]);
    expect(piecePlacementCells(trayState(game, false, true), pieceB)).toEqual([
      { cell: [5, 0], label: "6,1" },
    ]);
  });

  it("is empty (the shared reference) when the hint is off", () => {
    const off = trayState(game);
    expect(piecePlacementCells(off, pieceA)).toEqual([]);
    // A flag-off tray renders no buttons whatever the cache holds — and the stable
    // empty identity keeps memo comparisons cheap across recomputes.
    expect(piecePlacementCells(off, pieceA)).toBe(
      piecePlacementCells(off, pieceB),
    );
  });

  it("is empty for a value absent from the cache even with the hint on", () => {
    const stray = createPiece([2, 2, 2], 3, 3);
    expect(piecePlacementCells(trayState(game, false, true), stray)).toEqual(
      [],
    );
  });
});

describe("placeTrayPiece (Phase 13 click-to-place commit)", () => {
  // A real, freshly-unfolded game (never a hand-authored fixture): `placePiece`
  // indexes the board, recomputes both caches, and records the move.
  const GAME_SEED = 42;

  function buildGame(preventInvalidMoves = true): Game {
    return unfoldGame(buildBoard(4, 3, 3, GAME_SEED), { preventInvalidMoves });
  }

  /**
   * A (piece, blank cell) pair where the piece does NOT legally fit the cell: every
   * unfolded tray piece has ≥1 fit cell, but not every blank cell admits every tray
   * piece, so some such pair always exists.
   */
  function pickIllegalPlacement(game: Game): readonly [Piece, Cell] {
    for (const [piece, fits] of game.pieceToFitCells) {
      for (const idx of game.cellToFitPieces.keys()) {
        if (!fits.includes(idx)) return [piece, cellFromIndex(game.size, idx)];
      }
    }
    throw new Error("fixture: no illegal placement found (impossible)");
  }

  it("delegates to placePiece: board filled, tray decremented, caches recomputed, move recorded", () => {
    const game = buildGame();
    const state = trayState(game, true, true);
    const [piece, [row, col]] = pickLegalPlacement(game);
    const targetIdx = cellIndex(game.size, row, col);
    const countBefore = game.availablePieces.get(piece);
    if (countBefore === undefined)
      throw new Error("fixture: legal piece missing from tray (impossible)");

    const next = placeTrayPiece(state, piece, [row, col]);

    expect(next).not.toBe(state);
    expect(next.game).not.toBe(game);
    expect(next.game.board[row][col]).toBe(piece);
    if (countBefore > 1)
      expect(next.game.availablePieces.get(piece)).toBe(countBefore - 1);
    else expect(next.game.availablePieces.get(piece)).toBeUndefined();
    expect(next.game.placedCells).toHaveLength(game.placedCells.length + 1);
    const move = next.game.placedCells.at(-1);
    if (move === undefined)
      throw new Error("expected a recorded move after a click-to-place");
    expect(move).toEqual({
      pieceValue: piece,
      cell: [row, col],
      isValid: true,
    });
    // The moved cell is no longer anyone's fit cell in the recomputed caches.
    for (const cells of next.game.pieceToFitCells.values()) {
      expect(cells).not.toContain(targetIdx);
    }
    for (const cells of next.game.cellToFitPieces.values()) {
      expect(cells).not.toContain(piece);
    }
    // The hint flags pass through unchanged.
    expect(next.availablePieceUniqueCell).toBe(true);
    expect(next.pieceCells).toBe(true);
  });

  it("does not mutate the input state", () => {
    const game = buildGame();
    const state = trayState(game);
    const [piece, [row, col]] = pickLegalPlacement(game);

    placeTrayPiece(state, piece, [row, col]);

    expect(game.board[row][col]).toBeNull();
    expect(game.placedCells).toHaveLength(0);
  });

  it("surfaces placePiece's out-of-bounds throw (the tray never invents cells of its own)", () => {
    const state = trayState(buildGame());
    const [piece] = pickLegalPlacement(state.game);
    expect(() => placeTrayPiece(state, piece, [99, 0])).toThrow();
  });

  it("surfaces placePiece's invalid-move throw when preventInvalidMoves is on", () => {
    const game = buildGame();
    const state = trayState(game);
    const [piece, cell] = pickIllegalPlacement(game);
    expect(() => placeTrayPiece(state, piece, cell)).toThrow();
  });

  it("applies an invalid move unchanged when preventInvalidMoves is off (recorded isValid: false)", () => {
    const game = buildGame(false);
    const state = trayState(game);
    const [piece, cell] = pickIllegalPlacement(game);

    const next = placeTrayPiece(state, piece, cell);
    expect(next.game.board[cell[0]][cell[1]]).toBe(piece);
    const move = next.game.placedCells.at(-1);
    if (move === undefined) throw new Error("expected a recorded move");
    expect(move.isValid).toBe(false);
  });
});
