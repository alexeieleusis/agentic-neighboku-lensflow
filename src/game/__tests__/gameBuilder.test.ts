import { describe, expect, it } from "vitest";
import {
  buildBoard,
  buildPiecePool,
  buildPossibleNeighbors,
  type Board,
} from "../boardBuilder";
import { isValidNeighbor } from "../common";
import { createPiece, isSamePiece, type Piece } from "../entities";
import {
  cellFromIndex,
  cellIndex,
  couldLegallyReplace,
  isLocked,
  lockedCells,
  pickNextLockedCell,
  placePiece,
  recomputeFitCaches,
  stateIsValid,
  undoPlay,
  unfoldGame,
  type Cell,
  type CellFitCache,
  type Game,
  type Move,
  type PieceFitCache,
  type Tray,
} from "../gameBuilder";

const P = (v: readonly number[]): Piece => createPiece(v, v.length, 3);

/** Build a `size × size` board of empty cells with the given (interned) pieces placed. */
function partialBoard(
  size: number,
  cells: readonly (readonly [number, number, Piece])[],
): Board {
  const rows: (Piece | null)[][] = Array.from({ length: size }, () =>
    new Array<Piece | null>(size).fill(null),
  );
  for (const [r, c, piece] of cells) rows[r][c] = piece;
  return rows;
}

/** Distinct tray piece values for the current `availablePieces`. */
function trayPieces(game: Game): Piece[] {
  return [...game.availablePieces.keys()].filter(
    (p) => (game.availablePieces.get(p) ?? 0) > 0,
  );
}

type MoveCandidate = {
  readonly piece: Piece;
  readonly cell: Cell;
  readonly idx: number;
};

/** A real, tray-available move that is LEGAL for the current board, read from the cache. */
function findValidMove(game: Game): MoveCandidate {
  for (const [piece, fits] of game.pieceToFitCells) {
    if (fits.length > 0) {
      const idx = fits[0];
      return { piece, cell: cellFromIndex(game.size, idx), idx };
    }
  }
  throw new Error("no valid move available in test setup");
}

/** A tray piece + blank cell that the piece does NOT legally occupy (the cache says so). */
function findInvalidMove(game: Game): MoveCandidate {
  const { size, board } = game;
  for (const piece of trayPieces(game)) {
    const fits = game.pieceToFitCells.get(piece) ?? [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== null) continue;
        const idx = cellIndex(size, r, c);
        if (!fits.includes(idx)) {
          return { piece, cell: [r, c] as Cell, idx };
        }
      }
    }
  }
  throw new Error("no invalid move available in test setup");
}

/** Recompute from scratch and assert the stored caches are exactly in sync. */
function expectCachesConsistent(game: Game): void {
  const fresh = recomputeFitCaches(game.board, game.size, trayPieces(game));
  expect(game.pieceToFitCells).toEqual(fresh.pieceToFitCells);
  expect(game.cellToFitPieces).toEqual(fresh.cellToFitPieces);
}

/** Count blank cells on a board. */
function blankCount(board: Board): number {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell === null) n++;
  return n;
}

/**
 * A small valid 2×2 block at the top-left of a 3×3 (every orthogonal pair shares exactly
 * one attribute; all four values distinct). Used to exercise isolated domain functions
 * where only the local neighborhood matters.
 */
const BLOCK: Readonly<{ a: Piece; b: Piece; c: Piece; d: Piece }> = {
  a: P([0, 1, 2]), // (0,0)
  b: P([0, 2, 1]), // (0,1) valid neighbor of a
  c: P([1, 2, 2]), // (1,0) valid neighbor of a
  d: P([0, 0, 2]), // (1,1) valid neighbor of b and c
};

function blockBoard(): Board {
  return partialBoard(3, [
    [0, 0, BLOCK.a],
    [0, 1, BLOCK.b],
    [1, 0, BLOCK.c],
    [1, 1, BLOCK.d],
  ]);
}

/** A tray-available piece that is a valid neighbor of both `BLOCK.b` and `BLOCK.c` but not a block piece. */
function findBlockReplacer(): Piece {
  const cands = buildPossibleNeighbors(BLOCK.b, 3).filter((p) =>
    buildPossibleNeighbors(BLOCK.c, 3).some((q) => isSamePiece(p, q)),
  );
  const replacer = cands.find(
    (p) =>
      !isSamePiece(p, BLOCK.a) &&
      !isSamePiece(p, BLOCK.b) &&
      !isSamePiece(p, BLOCK.c) &&
      !isSamePiece(p, BLOCK.d),
  );
  if (!replacer) throw new Error("No valid replacer found for block board");
  return replacer;
}

// =========================================================================
// couldLegallyReplace — "could a tray piece fill this cell as if it were blank"
// =========================================================================

describe("couldLegallyReplace", () => {
  it("is true for a piece that is a valid neighbor of the cell's neighbors and not in its row/col/section", () => {
    // Cell (0,0) holds `a`; its filled neighbors are `b` (right) and `c` (down).
    // Find a tray candidate that legally replaces `a` there.
    const board = blockBoard();
    const replacer = findBlockReplacer();
    expect(couldLegallyReplace(board, replacer, 0, 0)).toBe(true);
  });

  it("is false when the piece would violate the neighbor rule against a placed neighbor", () => {
    const board = blockBoard();
    // `d` = [0,0,2] shares two attributes with `b` ([0,2,1] → shares attr0) and one with
    // `c`; against `b` alone it is already invalid, so it cannot replace `a` at (0,0).
    // Use a piece that shares two attributes with `b` specifically.
    const badAgainstB = P([0, 2, 0]); // shares attr0 and attr1 with b=[0,2,1]
    expect(isSamePiece(badAgainstB, P([0, 2, 0]))).toBe(true);
    // (0,0)'s neighbors include b; a piece that is not a valid neighbor of b cannot fit.
    expect(couldLegallyReplace(board, badAgainstB, 0, 0)).toBe(false);
  });
});

// =========================================================================
// isLocked — the two-condition "candidate for removal" predicate
// =========================================================================

describe("isLocked", () => {
  it("(a) a filled cell with an empty tray and no isolation issue is locked", () => {
    const board = blockBoard();
    // (0,0): neighbors b and c each have 2 filled neighbors → not an isolation point.
    // empty tray → condition (a) is vacuously true.
    expect(isLocked(board, 3, [], 0, 0)).toBe(true);
  });

  it("(a) is negated when a tray piece could legally replace the cell", () => {
    const board = blockBoard();
    const replacer = findBlockReplacer();
    expect(isLocked(board, 3, [replacer], 0, 0)).toBe(false);
  });

  it("(b) the isolation guard blocks a cell that is its neighbor's sole filled neighbor", () => {
    // Two adjacent filled cells, nothing else: each is the other's ONLY filled neighbor.
    const board = partialBoard(3, [
      [0, 0, BLOCK.a],
      [0, 1, BLOCK.b],
    ]);
    // Even with an empty tray (condition (a) true), each cell fails the isolation guard.
    expect(isLocked(board, 3, [], 0, 0)).toBe(false);
    expect(isLocked(board, 3, [], 0, 1)).toBe(false);
  });

  it("returns false for an already-blank cell", () => {
    const board = blockBoard();
    expect(isLocked(board, 3, [], 2, 2)).toBe(false);
  });
});

describe("lockedCells", () => {
  it("returns no locked cells for a two-cell line (both fail the isolation guard)", () => {
    const board = partialBoard(3, [
      [0, 0, BLOCK.a],
      [0, 1, BLOCK.b],
    ]);
    expect(lockedCells(board, 3, [])).toEqual([]);
  });

  it("reports the block cells that pass both conditions with an empty tray", () => {
    const board = blockBoard();
    const locked = lockedCells(board, 3, []);
    // With an empty tray only the isolation guard decides. Every block cell has ≥2
    // filled neighbors that themselves have ≥2 filled neighbors, so the whole block is
    // locked; the three outer-empty cells are blank and skipped.
    expect(locked).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });
});

// =========================================================================
// pickNextLockedCell — the size-dependent removal-frequency tie-break
// =========================================================================

describe("pickNextLockedCell", () => {
  const pa = P([0, 1, 2]);
  const pb = P([1, 0, 2]);
  const locked: Cell[] = [
    [0, 0],
    [0, 1],
  ];

  it("returns undefined when no cell is locked", () => {
    const board = partialBoard(3, [
      [0, 0, pa],
      [0, 1, pb],
    ]);
    expect(pickNextLockedCell([], board, 3, new Map())).toBeUndefined();
  });

  it("size > 4 prefers the LOWEST removal-frequency value", () => {
    const board = partialBoard(6, [
      [0, 0, pa],
      [0, 1, pb],
    ]);
    const freq = new Map<Piece, number>([
      [pa, 0],
      [pb, 2],
    ]);
    expect(pickNextLockedCell(locked, board, 6, freq)).toEqual([0, 0]); // pa (freq 0)
  });

  it("size <= 4 prefers the HIGHEST removal-frequency value", () => {
    const board = partialBoard(3, [
      [0, 0, pa],
      [0, 1, pb],
    ]);
    const freq = new Map<Piece, number>([
      [pa, 0],
      [pb, 2],
    ]);
    expect(pickNextLockedCell(locked, board, 3, freq)).toEqual([0, 1]); // pb (freq 2)
  });
});

// =========================================================================
// unfoldGame — stop condition + post-unfold invariants
// =========================================================================

describe("unfoldGame", () => {
  for (const size of [4, 6, 9] as const) {
    it(`stops exactly when no locked cells remain (size ${size})`, () => {
      const solved = buildBoard(size, 3, 3, 42);
      const game = unfoldGame(solved, { preventInvalidMoves: false });

      // Stop condition: with the resulting tray, not a single remaining filled cell is
      // locked any more.
      expect(lockedCells(game.board, size, trayPieces(game))).toEqual([]);

      // The unfolded board is a valid partial solved board: it only ever REMOVED cells,
      // so row/col/section uniqueness and the neighbor rule still hold.
      assertPartialBoard(game.board, size);
    });

    it(`preserves the invariant: blank cells === tray units (size ${size})`, () => {
      const solved = buildBoard(size, 3, 3, 7);
      const game = unfoldGame(solved, { preventInvalidMoves: false });
      const unitPieces = [...game.availablePieces.values()].reduce(
        (a, b) => a + b,
        0,
      );
      expect(blankCount(game.board)).toBe(unitPieces);
    });

    it(`is deterministic for a fixed solved board (size ${size})`, () => {
      const solved = buildBoard(size, 3, 3, 11);
      const g1 = unfoldGame(solved, { preventInvalidMoves: false });
      const g2 = unfoldGame(solved, { preventInvalidMoves: false });
      expect(g1.board).toEqual(g2.board);
      expect(g1.availablePieces).toEqual(g2.availablePieces);
    });

    it(`post-unfold caches are mutually consistent (size ${size})`, () => {
      const solved = buildBoard(size, 3, 3, 3);
      const game = unfoldGame(solved, { preventInvalidMoves: false });
      expectCachesConsistent(game);
    });
  }
});

// =========================================================================
// placePiece — throw vs. record, and state updates
// =========================================================================

describe("placePiece", () => {
  it("records a valid move with isValid=true, decrements the tray, fills the cell, and keeps caches in sync", () => {
    const game = unfoldGame(buildBoard(4, 3, 3, 5), {
      preventInvalidMoves: true,
    });
    const { piece, cell, idx } = findValidMove(game);
    const countBefore = game.availablePieces.get(piece) ?? 0;

    const next = placePiece(piece, cell, game);

    expect(next.placedCells.at(-1)).toEqual({
      pieceValue: piece,
      cell,
      isValid: true,
    });
    expect(next.board[cell[0]][cell[1]]).toBe(piece);
    // `?? 0` because a piece at one copy is dropped from the tray entirely (entry removed).
    expect(next.availablePieces.get(piece) ?? 0).toBe(countBefore - 1);
    // Board was replaced, not mutated in place: the source cell is still blank in `game`.
    const [srcRow, srcCol] = cellFromIndex(game.size, idx);
    expect(game.board[srcRow][srcCol]).toBeNull();
    expectCachesConsistent(next);
  });

  it("drops the tray entry at zero when the last copy of a value is placed", () => {
    const game = unfoldGame(buildBoard(4, 3, 3, 9), {
      preventInvalidMoves: false,
    });
    // Find a valid move whose piece is down to a single copy.
    let mover: { readonly piece: Piece; readonly cell: Cell } | undefined;
    for (const [piece, fits] of game.pieceToFitCells) {
      if (fits.length > 0 && game.availablePieces.get(piece) === 1) {
        mover = { piece, cell: cellFromIndex(game.size, fits[0]) };
        break;
      }
    }
    if (mover === undefined)
      throw new Error("no single-copy move available in test setup");
    const next = placePiece(mover.piece, mover.cell, game);
    expect(next.availablePieces.has(mover.piece)).toBe(false);
  });

  it("throws — and mutates nothing — on an invalid move when preventInvalidMoves is true", () => {
    const game = unfoldGame(buildBoard(4, 3, 3, 5), {
      preventInvalidMoves: true,
    });
    const { piece, cell } = findInvalidMove(game);

    expect(() => placePiece(piece, cell, game)).toThrow();

    // Input game is untouched: no move recorded, target cell still blank, caches intact.
    expect(game.placedCells).toHaveLength(0);
    expect(game.board[cell[0]][cell[1]]).toBeNull();
    expectCachesConsistent(game);
  });

  it("does NOT throw, and records isValid=false while still applying, when preventInvalidMoves is false", () => {
    const game = unfoldGame(buildBoard(4, 3, 3, 5), {
      preventInvalidMoves: false,
    });
    const { piece, cell } = findInvalidMove(game);
    const countBefore = game.availablePieces.get(piece) ?? 0;

    const next = placePiece(piece, cell, game);

    expect(next.placedCells.at(-1)).toEqual({
      pieceValue: piece,
      cell,
      isValid: false,
    });
    expect(next.board[cell[0]][cell[1]]).toBe(piece); // applied to the board
    // `?? 0` because an invalid move on a one-copy piece still drops its tray entry.
    expect(next.availablePieces.get(piece) ?? 0).toBe(countBefore - 1); // tray decremented
    expectCachesConsistent(next);
  });

  it("with preventInvalidMoves=false, placing into a filled cell overwrites it (original piece is lost)", () => {
    const game = unfoldGame(buildBoard(4, 3, 3, 5), {
      preventInvalidMoves: false,
    });
    // Find an actually-filled cell (unfoldGame leaves some cells blank).
    let row = -1;
    let col = -1;
    for (let r = 0; r < game.size; r++) {
      for (let c = 0; c < game.size; c++) {
        if (game.board[r][c] !== null) {
          row = r;
          col = c;
          break;
        }
      }
      if (row !== -1) break;
    }
    expect(row).toBeGreaterThanOrEqual(0);
    const originalPiece = game.board[row]![col]!;
    const { piece } = findValidMove(game);

    const next = placePiece(piece, [row, col] as Cell, game);

    // The target cell now holds the placed piece — the original was overwritten.
    expect(next.board[row][col]).toBe(piece);
    // The original piece is gone from the board entirely and was never in the tray,
    // so it is lost from the game (silent state corruption by design).
    expect(next.board.some((r) => r.includes(originalPiece))).toBe(false);
    expect(next.availablePieces.get(originalPiece) ?? 0).toBe(0);
  });
});

// =========================================================================
// undoPlay — inverse of placePiece, cache recomputation, and the §8.4 no-guard
// =========================================================================

describe("undoPlay", () => {
  it("reverses a placed move: restores the tray entry, blanks the cell, and recomputes caches", () => {
    const g0 = unfoldGame(buildBoard(4, 3, 3, 5), {
      preventInvalidMoves: false,
    });
    const { piece, cell } = findValidMove(g0);
    const countBefore = g0.availablePieces.get(piece) ?? 0;

    const g1 = placePiece(piece, cell, g0);
    const g2 = undoPlay(g1);

    expect(g2.board[cell[0]][cell[1]]).toBeNull();
    expect(g2.board).toEqual(g0.board);
    expect(g2.availablePieces.get(piece)).toBe(countBefore);
    expect(g2.availablePieces).toEqual(g0.availablePieces);
    expect(g2.placedCells).toEqual(g0.placedCells);
    expectCachesConsistent(g2);
  });

  it("has no internal guard: undoing an empty move list throws (§8.4, reproduced, not fixed)", () => {
    // An unfolded game has no moves recorded, so `placedCells[placedCells.length - 1]`
    // is undefined and the destructuring throws — exactly as in the original, which the
    // UI masks by disabling Undo. We do NOT add a length check, early return, or a clean
    // thrown error with a bespoke message here.
    const g0 = unfoldGame(buildBoard(4, 3, 3, 5), {
      preventInvalidMoves: true,
    });
    expect(g0.placedCells).toHaveLength(0);
    expect(() => undoPlay(g0)).toThrow();
  });
});

// =========================================================================
// stateIsValid — the four-condition validity predicate (§3.6)
// =========================================================================

function mkGame(opts: {
  readonly size: number;
  readonly board: Board;
  availablePieces: Tray;
  placedCells?: readonly Move[];
  pieceToFitCells?: PieceFitCache;
  cellToFitPieces?: CellFitCache;
}): Game {
  return {
    size: opts.size,
    board: opts.board,
    availablePieces: opts.availablePieces,
    placedCells: opts.placedCells ?? [],
    pieceToFitCells: opts.pieceToFitCells ?? new Map(),
    cellToFitPieces: opts.cellToFitPieces ?? new Map(),
    preferences: { preventInvalidMoves: false },
  };
}

describe("stateIsValid", () => {
  it("is true for a fully-solved board where every recorded move is valid", () => {
    const solved = buildBoard(3, 3, 3, 1);
    const moves: Move[] = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const piece = solved[r][c];
        expect(piece).not.toBeNull();
        moves.push({ pieceValue: piece!, cell: [r, c], isValid: true });
      }
    expect(
      stateIsValid(
        mkGame({
          size: 3,
          board: solved,
          availablePieces: new Map(),
          placedCells: moves,
        }),
      ),
    ).toBe(true);
  });

  it("(1) is false when any recorded move is invalid", () => {
    const solved = buildBoard(3, 3, 3, 1);
    const moves: Move[] = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const piece = solved[r][c];
        expect(piece).not.toBeNull();
        moves.push({ pieceValue: piece!, cell: [r, c], isValid: true });
      }
    moves[moves.length - 1] = { ...moves.at(-1)!, isValid: false };
    expect(
      stateIsValid(
        mkGame({
          size: 3,
          board: solved,
          availablePieces: new Map(),
          placedCells: moves,
        }),
      ),
    ).toBe(false);
  });

  it("(2) is false when a blank cell has no tray piece that could fit it", () => {
    // 1 blank (idx 0), 1 tray unit (X). Caches: no fit for the blank → (2) alone fails.
    const x = P([0, 1, 2]);
    const board = partialBoard(2, [
      [0, 1, P([1, 1, 1])],
      [1, 0, P([2, 2, 0])],
      [1, 1, P([0, 0, 0])],
    ]);
    const base = {
      size: 2,
      board,
      availablePieces: new Map<Piece, number>([[x, 1]]),
      pieceToFitCells: new Map<Piece, readonly number[]>([[x, [0]]]),
      cellToFitPieces: new Map<number, readonly Piece[]>(),
    };
    expect(
      stateIsValid(
        mkGame({
          ...base,
          cellToFitPieces: new Map<number, readonly Piece[]>([[0, []]]),
        }),
      ),
    ).toBe(false); // blank 0 has zero fits
    // Positive control: give the blank a fit and nothing else changes.
    expect(
      stateIsValid(
        mkGame({
          ...base,
          cellToFitPieces: new Map<number, readonly Piece[]>([[0, [x]]]),
        }),
      ),
    ).toBe(true);
  });

  it("(3) is false when a tray piece has no cell it could fit", () => {
    // 2 blanks, 2 tray units. Both blanks fit Y; X fits none → only condition (3) fails.
    const x = P([0, 0, 1]);
    const y = P([1, 1, 0]);
    const board = partialBoard(2, [
      [0, 0, P([2, 0, 0])],
      [0, 1, P([0, 2, 2])],
    ]);
    const base = {
      size: 2,
      board,
      availablePieces: new Map<Piece, number>([
        [x, 1],
        [y, 1],
      ]),
      cellToFitPieces: new Map<number, readonly Piece[]>([
        [2, [y]],
        [3, [y]],
      ]),
    };
    expect(
      stateIsValid(
        mkGame({
          ...base,
          pieceToFitCells: new Map<Piece, readonly number[]>([
            [x, []],
            [y, [2, 3]],
          ]),
        }),
      ),
    ).toBe(false); // x fits no cell
    // Positive control: give x a fit and nothing else changes.
    expect(
      stateIsValid(
        mkGame({
          ...base,
          pieceToFitCells: new Map<Piece, readonly number[]>([
            [x, [2]],
            [y, [2, 3]],
          ]),
        }),
      ),
    ).toBe(true);
  });

  it("(4) is false when the blank count differs from the remaining tray units", () => {
    // 1 blank but 2 tray units, all otherwise satisfiable → cardinality guard trips.
    const x = P([0, 1, 1]);
    const y = P([1, 0, 1]);
    const board = partialBoard(2, [
      [0, 1, P([2, 2, 0])],
      [1, 0, P([2, 0, 2])],
      [1, 1, P([0, 0, 0])],
    ]);
    const caches = {
      cellToFitPieces: new Map<number, readonly Piece[]>([[0, [x, y]]]),
      pieceToFitCells: new Map<Piece, readonly number[]>([
        [x, [0]],
        [y, [0]],
      ]),
    };
    expect(
      stateIsValid(
        mkGame({
          size: 2,
          board,
          availablePieces: new Map<Piece, number>([
            [x, 1],
            [y, 1],
          ]),
          ...caches,
        }),
      ),
    ).toBe(false); // 1 blank vs 2 units
    // Positive control: drop to one unit and recompute the piece cache consistently.
    const oneUnit = new Map<Piece, number>([[x, 1]]);
    const oneCaches = {
      cellToFitPieces: new Map<number, readonly Piece[]>([[0, [x]]]),
      pieceToFitCells: new Map<Piece, readonly number[]>([[x, [0]]]),
    };
    expect(
      stateIsValid(
        mkGame({ size: 2, board, availablePieces: oneUnit, ...oneCaches }),
      ),
    ).toBe(true);
  });
});

// =========================================================================
// §8.7 — reference-vs-value equality: intentionally preserved, flagged to the reviewer
// =========================================================================

describe("§8.7 reference-vs-value equality (preserved, not fixed)", () => {
  it("keys piece caches by interned piece identity, so value-equal pieces share a key", () => {
    const pool = buildPiecePool(3, 3);
    const a = pool[0];
    // A second, value-equal piece is the SAME interned reference — which is what keeps
    // the reference-based `Map`/`includes` comparisons in this module inertly value-correct.
    expect(pool.find((p) => isSamePiece(p, a))).toBe(a);
    // The known gap: a NON-interned piece with an equal value would be treated as a
    // DISTINCT key. We reproduce (rather than patch) that behavior per backlog.md §8.7.
    const copy = P([...a]); // fresh, non-interned reference with equal values
    expect(copy).not.toBe(a);
  });
});

// =========================================================================
// invariants
// =========================================================================

/** Every filled cell is value-unique within its row/column; the neighbor rule holds. */
function assertPartialBoard(board: Board, size: number): void {
  assertRowColUniqueness(board, size);
  assertOrthogonalNeighbors(board, size);
}

/** No piece value repeats within any single row or column. */
function assertRowColUniqueness(board: Board, size: number): void {
  const rows: Set<Piece>[] = Array.from({ length: size }, () => new Set());
  const cols: Set<Piece>[] = Array.from({ length: size }, () => new Set());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = board[r][c];
      if (piece === null) continue;
      expect(rows[r].has(piece), `row ${r} duplicate`).toBe(false);
      rows[r].add(piece);
      expect(cols[c].has(piece), `col ${c} duplicate`).toBe(false);
      cols[c].add(piece);
    }
  }
}

/** Every orthogonally-adjacent pair of filled pieces satisfies the neighbor rule. */
function assertOrthogonalNeighbors(board: Board, size: number): void {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = board[r][c];
      if (piece === null) continue;
      if (c + 1 < size) assertNeighborPair(piece, board[r][c + 1]);
      if (r + 1 < size) assertNeighborPair(piece, board[r + 1][c]);
    }
  }
}

/** Check one directional neighbor: valid when filled, silently skipped when blank. */
function assertNeighborPair(piece: Piece, neighbor: Piece | null): void {
  if (neighbor === null) return;
  expect(isValidNeighbor(piece, neighbor)).toBe(true);
}
