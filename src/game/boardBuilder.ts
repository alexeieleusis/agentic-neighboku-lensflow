import type { Piece } from "./entities";
import { createPiece } from "./entities";
import { isValidNeighbor } from "./common";

/** A square board. A cell is either a placed {@link Piece} or an empty `null` slot. */
export type Board = readonly (readonly (Piece | null)[])[];

/**
 * Orthogonal offsets (up, left, down, right). Diagonals are intentionally absent:
 * the neighbor rule is orthogonal-only — replicated as observed (requirements §8.1).
 */
const ORTHOGONAL_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
];

/**
 * Largest prime factor of `n` (requirements §3.3). This IS the section size: a
 * `size` board is tiled into `sectionSize × sectionSize` sub-grids, and because the
 * result is a factor of `size`, `size / sectionSize` is integral and the tiling is
 * exact. Prime `size` ⇒ `sectionSize === size` (one section covering the whole board).
 * Computed, not looked up — no hard-coded section-size table.
 */
export function sectionSize(size: number): number {
  let remaining = size;
  let largest = 0;
  for (let factor = 2; factor * factor <= remaining; factor++) {
    if (remaining % factor === 0) {
      largest = factor;
      while (remaining % factor === 0) {
        remaining = remaining / factor;
      }
    }
  }
  if (remaining > 1) {
    largest = remaining;
  }
  return largest;
}

/**
 * The complete pool of every `base^dimension` distinct piece value, interned: each
 * distinct value vector maps to exactly one frozen `Piece` instance. Interning is what
 * makes the reference-based comparisons throughout this module behave as if they were
 * value-based (see the §8.7 notes at the comparison sites).
 */
export function buildPiecePool(
  dimension: number,
  base: number,
): readonly Piece[] {
  if (dimension < 1)
    throw new RangeError("dimension must be a positive integer");
  if (base < 1) throw new RangeError("base must be a positive integer");
  const total = Math.pow(base, dimension);
  const pool: Piece[] = new Array(total);
  for (let i = 0; i < total; i++) {
    const digits: number[] = new Array(dimension);
    let n = i;
    for (let d = dimension - 1; d >= 0; d--) {
      digits[d] = n % base;
      n = Math.floor(n / base);
    }
    pool[i] = createPiece(digits, dimension, base);
  }
  return Object.freeze(pool) as readonly Piece[];
}

/**
 * The pieces occupying the already-filled orthogonal neighbor cells of `(row, col)`.
 * During a row-major fill only the up and left cells are placed yet, so this naturally
 * yields exactly the two neighbors the rule should be checked against — down and right
 * are never consulted. Empty (unplaced) cells are skipped. Shared by `buildBoard` and
 * the later puzzle unfolding.
 */
export function findNeighbors(
  board: Board,
  row: number,
  col: number,
): readonly Piece[] {
  const size = board.length;
  const found: Piece[] = [];
  for (const [dr, dc] of ORTHOGONAL_OFFSETS) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= size || c < 0 || c >= size) continue;
    const cell = board[r][c];
    if (cell !== null) found.push(cell);
  }
  return found;
}

/**
 * Piece values already used in the same row, column, or section as `(row, col)` — the
 * pieces that must be excluded from candidacy here, enforcing row/column/section
 * uniqueness (requirements §3.3).
 */
export function findExclusions(
  board: Board,
  row: number,
  col: number,
): readonly Piece[] {
  const size = board.length;
  const sSize = sectionSize(size);
  const exclusions: Piece[] = [];
  const seen = new Set<Piece>();
  const add = (cell: Piece | null): void => {
    // §8.7 (replicated, flagged for human review): dedup is by reference identity of the
    // (interned) piece instances, not value equality. All board cells are pool references,
    // so equal values share a reference and this is inertly value-correct in this build.
    if (cell !== null && !seen.has(cell)) {
      seen.add(cell);
      exclusions.push(cell);
    }
  };
  for (let c = 0; c < size; c++) {
    if (c !== col) add(board[row][c]);
  }
  for (let r = 0; r < size; r++) {
    if (r !== row) add(board[r][col]);
  }
  const sectionRow = Math.floor(row / sSize) * sSize;
  const sectionCol = Math.floor(col / sSize) * sSize;
  for (let r = sectionRow; r < sectionRow + sSize && r < size; r++) {
    for (let c = sectionCol; c < sectionCol + sSize && c < size; c++) {
      if (r === row && c === col) continue;
      add(board[r][c]);
    }
  }
  return exclusions;
}

/**
 * Every piece (drawn from the full `base^dimension` space) that is a valid neighbor of
 * `piece` — i.e. shares exactly one attribute with it. No exclusions; this is the pure
 * "possible neighbors of X" set used, for example, by the Help panel (requirements §5.10).
 */
export function buildPossibleNeighbors(
  piece: Piece,
  base: number,
): readonly Piece[] {
  const dimension = piece.length;
  const pool = buildPiecePool(dimension, base);
  const out: Piece[] = [];
  for (const candidate of pool) {
    // §8.7 (replicated, flagged for human review): `candidate !== piece` is a reference
    // comparison (self-exclude). For a pool-referenced `piece` the matching value is
    // skipped; for any other `piece`, `isValidNeighbor` below already excludes the equal value.
    if (candidate !== piece && isValidNeighbor(piece, candidate)) {
      out.push(candidate);
    }
  }
  return out;
}

/**
 * Of `candidates`, keep only those that satisfy the neighbor rule against **every**
 * placed neighbor in `neighbors`. When there are no placed neighbors yet (the very first
 * cell, or any isolated candidate), the rule is vacuous and all candidates survive.
 */
export function validNeighbors(
  candidates: readonly Piece[],
  neighbors: readonly Piece[],
): readonly Piece[] {
  if (neighbors.length === 0) return candidates;
  return candidates.filter((piece) =>
    neighbors.every((neighbor) => isValidNeighbor(piece, neighbor)),
  );
}

/** Deterministic PRNG (mulberry32) so a given seed reproduces a given board exactly. */
function createRng(seed?: number): () => number {
  let state = (seed ?? Math.random() * 0x100000000) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How many times `piece` already appears anywhere on the board — for the soft
 * "prefer least-used" global-uniformity heuristic (requirements §3.1).
 *
 * §8.7 (replicated, flagged for human review): counts by reference (`===`) rather than by
 * value equality. All board cells are pool references, so equal values share a reference
 * and this is inertly value-correct in this build.
 */
function countOnBoard(board: Board, piece: Piece): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === piece) count++;
    }
  }
  return count;
}

/**
 * From `valid` candidates, pick the least-frequently-used piece on `draft`, breaking
 * ties with a seeded random pick (soft "prefer least-used" heuristic, requirements §3.1).
 */
function pickLeastUsed(
  valid: readonly Piece[],
  draft: (Piece | null)[][],
  rng: () => number,
): Piece {
  let least = Infinity;
  for (const piece of valid) {
    const n = countOnBoard(draft, piece);
    if (n < least) least = n;
  }
  const tied = valid.filter((piece) => countOnBoard(draft, piece) === least);
  return tied[Math.trunc(rng() * tied.length)];
}

/**
 * Generates a complete, valid Neighboku board (requirements §3.1, §3.3).
 *
 * Strategy (deliberately faithful to the original, NOT backtracking):
 *  - Fill cells strictly row-major, left-to-right, top-to-bottom.
 *  - For each cell, candidates are the pool pieces not yet used in that row / column /
 *    section that remain valid neighbors of every already-placed orthogonal neighbor.
 *  - Among the survivors, prefer the least-frequently-used pieces so far on the board
 *    (soft heuristic), breaking ties with a (seeded) random pick.
 *  - If any cell runs out of candidates, the entire build is abandoned and retried from
 *    scratch (no partial-board backtracking).
 *
 * Feasibility: a board is only fillable when the pool has enough distinct values. For
 * non-prime `size` the binding constraint is row uniqueness (pool ≥ `size`); for prime
 * `size`, `sectionSize === size` makes the whole board one section, so global uniqueness
 * requires pool ≥ `size²`. With (dimension, base) = (3, 3) the pool is 27, so non-prime
 * sizes up to 26 and prime sizes up to 5 are fillable; e.g. `buildBoard(7, 3, 3)` is not.
 * A configuration that cannot be completed throws after `maxAttempts` (1000) whole-board
 * retries instead of looping forever.
 *
 * `seed` (optional) seeds the tie-break PRNG, making output deterministic for tests.
 */
export function buildBoard(
  size: number,
  dimension: number,
  base: number,
  seed?: number,
): Board {
  if (size < 1) throw new RangeError("size must be a positive integer");
  const pool = buildPiecePool(dimension, base);
  const rng = createRng(seed);
  // Safety valve for infeasible configurations (see feasibility note above): an
  // incomplete build would otherwise retry forever, so cap whole-board retries.
  const maxAttempts = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const draft: (Piece | null)[][] = Array.from({ length: size }, () =>
      new Array<Piece | null>(size).fill(null),
    );

    let deadEnd = false;
    for (let row = 0; row < size && !deadEnd; row++) {
      for (let col = 0; col < size; col++) {
        const exclusions = findExclusions(draft, row, col);
        const neighbors = findNeighbors(draft, row, col);
        // §8.7 (replicated, flagged for human review): exclusion membership by reference
        // via `Array.prototype.includes` on the interned pieces, not value equality. All
        // board cells are pool references, so equal values share a reference and this is
        // inertly value-correct in this build.
        const candidates = pool.filter((piece) => !exclusions.includes(piece));
        const valid = validNeighbors(candidates, neighbors);
        if (valid.length === 0) {
          deadEnd = true;
          break;
        }
        draft[row][col] = pickLeastUsed(valid, draft, rng);
      }
    }

    if (!deadEnd) {
      // Deep-freeze the completed board (fresh frozen copies; piece refs are already
      // immutable and shared via interning).
      const finished: Board = draft.map((row) => Object.freeze(row.slice()));
      return finished;
    }
  }

  throw new Error(
    `buildBoard(${size}x${size}, dimension=${dimension}, base=${base}): ` +
      `no valid board found after ${maxAttempts} attempts`,
  );
}
