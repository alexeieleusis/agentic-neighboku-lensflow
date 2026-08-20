import { describe, expect, it } from "vitest";
import {
  buildBoard,
  buildPiecePool,
  buildPossibleNeighbors,
  findExclusions,
  findNeighbors,
  sectionSize,
  validNeighbors,
  type Board,
} from "../boardBuilder";
import { createPiece, isSamePiece } from "../entities";
import type { Piece } from "../entities";

const P = (v: readonly number[]): Piece => createPiece(v, v.length, 3);

/**
 * Build a `size × size` board of empty cells with specific cells filled with the given
 * (interned) pieces. Passing the same piece reference to two cells preserves that
 * identity, which is what the reference-based exclusions/tests below rely on.
 */
function partialBoard(
  size: number,
  cells: readonly (readonly [number, number, Piece])[],
): Board {
  const rows: (Piece | null)[][] = Array.from({ length: size }, () =>
    new Array<Piece | null>(size).fill(null),
  );
  for (const [r, c, piece] of cells) {
    rows[r][c] = piece;
  }
  return rows;
}

describe("sectionSize (largest prime factor of the board size)", () => {
  const cases: readonly (readonly [number, number])[] = [
    [9, 3],
    [6, 3],
    [8, 2],
    [16, 2],
    [4, 2],
    [12, 3],
    [10, 5],
    // prime size => largest prime factor is the size itself (one big section)
    [7, 7],
    [5, 5],
    [2, 2],
  ];
  for (const [size, expected] of cases) {
    it(`size ${size} => section size ${expected}`, () => {
      expect(sectionSize(size)).toBe(expected);
    });
  }
});

describe("buildPiecePool", () => {
  it("creates exactly base^dimension distinct, valid pieces", () => {
    const pool = buildPiecePool(2, 3);
    expect(pool.length).toBe(9);
    for (const p of pool) {
      expect(p.length).toBe(2);
      for (const d of p) {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(3);
        expect(Number.isInteger(d)).toBe(true);
      }
    }
  });

  it("is interned: a given value maps to exactly one canonical reference", () => {
    const pool = buildPiecePool(2, 3);
    const value = pool[3]; // [1,0]
    const sameValue = pool.filter((p) => isSamePiece(p, value));
    expect(sameValue.length).toBe(1);
    expect(sameValue[0]).toBe(value); // same reference, not merely equal
  });
});

describe("findNeighbors", () => {
  it("returns all currently-filled orthogonal neighbors of a cell", () => {
    const up = P([0, 1, 2]);
    const left = P([1, 0, 2]);
    const board = partialBoard(3, [
      [0, 1, up],
      [1, 0, left],
    ]);
    expect(findNeighbors(board, 1, 1)).toEqual([up, left]);
  });

  it("skips empty cells and out-of-bounds positions", () => {
    const left = P([0, 1, 2]);
    const board = partialBoard(3, [[0, 0, left]]);
    expect(findNeighbors(board, 0, 0)).toEqual([]);
    expect(findNeighbors(board, 0, 1)).toEqual([left]);
  });

  // Generic "filled orthogonal neighbors" helper: during a row-major fill only up/left
  // are ever placed, so the candidate check only consults those in practice; here we
  // confirm it also reports down/right when they are (arbitrarily) filled.
  it("reports down/right when they are filled (general helper)", () => {
    const down = P([0, 2, 0]);
    const right = P([1, 1, 2]);
    const board = partialBoard(3, [
      [2, 1, down],
      [1, 2, right],
    ]);
    expect(findNeighbors(board, 1, 1)).toEqual([down, right]);
  });
});

describe("findExclusions", () => {
  it("collects pieces already used in the row, column, or section (no self)", () => {
    // size 3 => sectionSize 3, i.e. a single section covering the whole board
    const a = P([0, 1, 2]);
    const b = P([0, 2, 0]);
    const c = P([1, 0, 1]);
    const board = partialBoard(3, [
      [0, 0, a],
      [1, 0, b],
      [0, 2, c],
    ]);
    const exclusions = findExclusions(board, 2, 2);
    for (const expected of [a, b, c]) {
      expect(exclusions.some((p) => isSamePiece(p, expected))).toBe(true);
    }
  });

  it("isolates row vs section vs outside on a size-4 board", () => {
    // size 4 => sectionSize 2. Target (1,1) is in section rows[0,1] x cols[0,1].
    const viaSection = P([0, 1, 2]); // at (0,0): same 2x2 section as (1,1), diff row/col
    const viaRow = P([1, 2, 0]); // at (1,3): same row as (1,1), diff col & section
    const outside = P([2, 2, 0]); // at (0,3): diff row, col, and section
    const board = partialBoard(4, [
      [0, 0, viaSection],
      [1, 3, viaRow],
      [0, 3, outside],
    ]);
    const exclusions = findExclusions(board, 1, 1);
    expect(exclusions.some((p) => isSamePiece(p, viaSection))).toBe(true);
    expect(exclusions.some((p) => isSamePiece(p, viaRow))).toBe(true);
    expect(exclusions.some((p) => isSamePiece(p, outside))).toBe(false);
  });

  it("dedupes a piece that satisfies several constraints at once", () => {
    // the same interned reference placed in both the target's section and its row must
    // appear only once in the exclusion list (reference dedup, §8.7)
    const pool = buildPiecePool(3, 3);
    const shared = pool[5]; // [0,1,2]
    const board = partialBoard(4, [
      [0, 0, shared], // in target's 2x2 section
      [1, 0, shared], // in target's row
    ]);
    const exclusions = findExclusions(board, 1, 1);
    expect(exclusions.filter((p) => p === shared)).toEqual([shared]);
  });
});

describe("buildPossibleNeighbors", () => {
  it("returns every piece sharing exactly one attribute (no exclusions)", () => {
    const piece = P([0, 1, 2]);
    const neighbors = buildPossibleNeighbors(piece, 3);
    // three positions; each exactly-one-shared group has (base-1)^2 = 4 members
    expect(neighbors.length).toBe(12);
    expect(neighbors.includes(piece)).toBe(false); // self excluded
    for (const n of neighbors) {
      const shared = n.filter((d, i) => d === piece[i]).length;
      expect(shared).toBe(1);
    }
  });

  it("rejects zero-shared and two-or-more-shared pieces", () => {
    const piece = P([0, 1, 2]);
    const neighbors = buildPossibleNeighbors(piece, 3);
    // three shared -> excluded; zero shared -> excluded; two shared -> excluded
    expect(neighbors.some((p) => isSamePiece(p, P([0, 1, 2])))).toBe(false);
    expect(neighbors.some((p) => isSamePiece(p, P([1, 2, 0])))).toBe(false);
    expect(neighbors.some((p) => isSamePiece(p, P([0, 1, 0])))).toBe(false);
    // exactly one shared -> included
    expect(neighbors.some((p) => isSamePiece(p, P([0, 2, 1])))).toBe(true);
  });
});

describe("validNeighbors", () => {
  it("returns all candidates when there are no placed neighbors yet", () => {
    const pieces = [P([0, 1, 2]), P([0, 2, 1]), P([2, 1, 0])];
    expect(validNeighbors(pieces, [])).toEqual(pieces);
  });

  it("keeps only candidates valid against a single placed neighbor", () => {
    const neighbor = P([0, 1, 2]);
    const candidates = [P([0, 2, 1]), P([1, 2, 0]), P([0, 1, 0])];
    const result = validNeighbors(candidates, [neighbor]);
    expect(result.some((p) => isSamePiece(p, P([0, 2, 1])))).toBe(true);
    expect(result.some((p) => isSamePiece(p, P([1, 2, 0])))).toBe(false); // 0 shared
    expect(result.some((p) => isSamePiece(p, P([0, 1, 0])))).toBe(false); // 2 shared
  });

  it("requires validity against every placed neighbor", () => {
    const up = P([0, 1, 2]);
    const left = P([0, 2, 1]);
    const pass = P([1, 1, 1]); // exactly one shared with up AND with left
    const failZero = P([2, 0, 1]); // zero shared with up
    const failTwo = P([0, 1, 1]); // two shared with up
    const selfUp = P([0, 1, 2]); // equals up -> three shared, invalid
    const result = validNeighbors(
      [pass, failZero, failTwo, selfUp],
      [up, left],
    );
    expect(result.length).toBe(1);
    expect(isSamePiece(result[0], pass)).toBe(true);
  });
});

describe("buildBoard (smoke + invariants)", () => {
  for (const size of [4, 6, 9] as const) {
    it(`produces a full ${size}x${size} board (dim 3, base 3) satisfying every rule`, () => {
      const board = buildBoard(size, 3, 3, 42);
      assertFullAndUnique(board, size);
      assertNeighborRule(board, size);
    });
  }

  it("is deterministic for a fixed seed", () => {
    expect(JSON.stringify(buildBoard(4, 3, 3, 7))).toBe(
      JSON.stringify(buildBoard(4, 3, 3, 7)),
    );
  });

  it("stays valid across different seeds", () => {
    for (const seed of [1, 99]) {
      const board = buildBoard(6, 3, 3, seed);
      assertFullAndUnique(board, 6);
      assertNeighborRule(board, 6);
    }
  });
});

// ---- invariants ------------------------------------------------------------------

/** Every cell filled; no value repeats within any row, column, or section. */
function assertFullAndUnique(board: Board, size: number): void {
  expect(board.length).toBe(size);
  if (board.length !== size) return;
  assertRowsAndColumns(board, size);
  assertSectionsUnique(board, size);
}

/** Every cell is filled and no value repeats within any row or column. */
function assertRowsAndColumns(board: Board, size: number): void {
  for (let r = 0; r < size; r++) {
    expect(board[r].length).toBe(size);
    const seenRow = new Set<Piece>();
    const seenCol = new Set<Piece>();
    for (let c = 0; c < size; c++) {
      const cell = board[r][c];
      expect(cell, `cell [${r}][${c}] not filled`).not.toBeNull();
      if (cell === null) continue;
      expect(seenRow.has(cell), `row ${r} has a duplicate value`).toBe(false);
      seenRow.add(cell);
      expect(seenCol.has(cell), `col ${c} has a duplicate value`).toBe(false);
      seenCol.add(cell);
    }
  }
}

/** No value repeats within any section of the largest-prime-factor tiling. */
function assertSectionsUnique(board: Board, size: number): void {
  const sSize = sectionSize(size);
  for (let sr = 0; sr < size; sr += sSize) {
    for (let sc = 0; sc < size; sc += sSize) {
      assertSectionRegion(board, size, sr, sc, sSize);
    }
  }
}

/** No value repeats within the single `sSize × sSize` region at `(sr, sc)`. */
function assertSectionRegion(
  board: Board,
  size: number,
  sr: number,
  sc: number,
  sSize: number,
): void {
  const seen = new Set<Piece>();
  for (let r = sr; r < sr + sSize && r < size; r++) {
    for (let c = sc; c < sc + sSize && c < size; c++) {
      const cell = board[r][c];
      if (cell === null) continue;
      expect(seen.has(cell), `section [${sr}][${sc}] duplicate`).toBe(false);
      seen.add(cell);
    }
  }
}

/** Every orthogonally-adjacent pair shares exactly one attribute. */
function assertNeighborRule(board: Board, size: number): void {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = board[r][c];
      if (piece === null) continue;
      if (c + 1 < size) {
        const right = board[r][c + 1];
        if (right !== null) {
          expect(neighborsShareExactlyOne(piece, right)).toBe(true);
        }
      }
      if (r + 1 < size) {
        const down = board[r + 1][c];
        if (down !== null) {
          expect(neighborsShareExactlyOne(piece, down)).toBe(true);
        }
      }
    }
  }
}

function neighborsShareExactlyOne(a: Piece, b: Piece): boolean {
  let shared = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) shared++;
  }
  return shared === 1;
}
