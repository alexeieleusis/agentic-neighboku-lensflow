import type { Piece } from "./entities";
import { isValidNeighbor } from "./common";
import { findExclusions, findNeighbors } from "./boardBuilder";
import type { Board } from "./boardBuilder";

/**
 * The puzzle unfolding & move engine (requirements §3.4, §3.5, §3.6). This module is a
 * pure, UI-free domain layer: every function is a total, side-effect-free transform on
 * read-only game state, and every update is expressed as a *new* object via spread/copy —
 * never in-place mutation (§7.3). The only React/UI-free imports are the sibling domain
 * primitives (§7.4).
 */

/** A board cell position: `[row, column]`, both 0-indexed. */
export type Cell = readonly [row: number, column: number];

/** A single recorded move, as appended to `Game.placedCells` (§3.5 step 6). */
export interface Move {
  readonly pieceValue: Piece;
  readonly cell: Cell;
  readonly isValid: boolean;
}

/**
 * The subset of user preferences the move engine reads. Wider preferences (`pieceType`,
 * hint flags, …) live in the app-level telescope and are deliberately outside the domain
 * (§7.4 keeps this module UI-free). Kept as a named object — rather than a bare boolean
 * on `Game` — so `unfoldGame` can seed it and later phases can widen it without reshaping
 * the move engine's signature (§3.5 names it `preferences.preventInvalidMoves`).
 */
export interface GamePreferences {
  readonly preventInvalidMoves: boolean;
}

/** Tray: interned piece value -> how many copies remain to be placed. */
export type Tray = ReadonlyMap<Piece, number>;

/** `tray piece value` -> linear indices of the blank cells it could legally occupy. */
export type PieceFitCache = ReadonlyMap<Piece, readonly number[]>;

/** `blank cell` (linear index) -> tray piece values that could legally occupy it. */
export type CellFitCache = ReadonlyMap<number, readonly Piece[]>;

/**
 * A single game in flight. `board` is the current on-screen state (a solved board
 * progressively blanked, then progressively re-filled). The two fit caches are recomputed
 * from `{ board, availablePieces }` after *every* mutation and are mutually consistent
 * with it (§3.4 final bullet, §3.5 steps 5, §3.6).
 */
export interface Game {
  readonly size: number;
  readonly board: Board;
  readonly availablePieces: Tray;
  readonly placedCells: readonly Move[];
  readonly pieceToFitCells: PieceFitCache;
  readonly cellToFitPieces: CellFitCache;
  readonly preferences: GamePreferences;
}

/** Orthogonal offsets — the same up/left/down/right set the board builder uses. */
const NEIGHBOR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
];

/** A freshly-unfolded game has no recorded moves yet. */
const NO_MOVES: readonly Move[] = [];

/** Flatten a cell position to `row * size + col` (the value-safe key for cell maps). */
export function cellIndex(size: number, row: number, col: number): number {
  return row * size + col;
}

/** Inverse of {@link cellIndex}. */
export function cellFromIndex(size: number, index: number): Cell {
  const row = Math.floor(index / size);
  const col = index % size;
  return [row, col];
}

function isOutOfBounds(size: number, row: number, col: number): boolean {
  return row < 0 || row >= size || col < 0 || col >= size;
}

/**
 * The core "could `piece` legally occupy the target cell" test, treating the target as
 * empty regardless of what is currently there. It checks the two and only two placement
 * rules: row/column/section uniqueness against every *other* board cell, and the neighbor
 * rule against every currently-filled orthogonal neighbor. `findExclusions`/`findNeighbors`
 * already omit the target cell itself, so this is correct whether the target is blank
 * (re-cache path) or filled (`couldLegallyReplace` path).
 *
 * §8.7 (replicated, flagged for human review): uniqueness is enforced by reference via
 * `Array.prototype.includes` on the interned (pool-referenced) pieces, not by deep value
 * equality. Board cells are always pool references, so equal values share an identity and
 * this is inertly value-correct in this build — the known "comparisons are by reference"
 * gap from backlog.md is preserved here, not fixed.
 */
function couldFitAt(
  board: Board,
  piece: Piece,
  row: number,
  col: number,
): boolean {
  const exclusions = findExclusions(board, row, col);
  if (exclusions.includes(piece)) return false;
  const neighbors = findNeighbors(board, row, col);
  return neighbors.every((n) => isValidNeighbor(piece, n));
}

/** `couldFitAt` restricted to a currently-blank cell (used by the fit caches). */
function fitsBlankCell(
  board: Board,
  piece: Piece,
  row: number,
  col: number,
): boolean {
  return board[row][col] === null && couldFitAt(board, piece, row, col);
}

/**
 * `true` if a filled cell could be legally re-occupied by `piece` as if it were blank
 * (§3.4 "none of the pieces already removed … could legally replace it").
 */
export function couldLegallyReplace(
  board: Board,
  piece: Piece,
  row: number,
  col: number,
): boolean {
  return couldFitAt(board, piece, row, col);
}

/**
 * §3.4 isolation guard: is `(row, col)` the *only* currently-filled orthogonal neighbor of
 * some of its own filled neighbors? Removing such a cell would leave that neighbor with
 * zero placed neighbors, which is never a candidate for removal (to avoid isolating
 * cells).
 */
function isSoleNeighborOfAnyNeighbor(
  board: Board,
  size: number,
  row: number,
  col: number,
): boolean {
  for (const [dr, dc] of NEIGHBOR_OFFSETS) {
    const nr = row + dr;
    const nc = col + dc;
    if (isOutOfBounds(size, nr, nc)) continue;
    if (board[nr][nc] === null) continue;
    if (findNeighbors(board, nr, nc).length === 1) return true;
  }
  return false;
}

/**
 * §3.4: a filled cell is "locked" — i.e. a candidate for blanking — only when BOTH hold:
 *   (1) no already-removed (tray) piece value could legally replace it, and
 *   (2) it is not the sole remaining filled neighbor of any of its own neighbors.
 * Cells failing either are never selected for removal.
 */
export function isLocked(
  board: Board,
  size: number,
  trayPieces: readonly Piece[],
  row: number,
  col: number,
): boolean {
  if (board[row][col] === null) return false;
  const replaceable = trayPieces.some((p) => couldFitAt(board, p, row, col));
  if (replaceable) return false;
  return !isSoleNeighborOfAnyNeighbor(board, size, row, col);
}

/** All currently-filled cells that are locked (§3.4), in row-major order. */
export function lockedCells(
  board: Board,
  size: number,
  trayPieces: readonly Piece[],
): readonly Cell[] {
  const locked: Cell[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === null) continue;
      if (isLocked(board, size, trayPieces, r, c)) locked.push([r, c]);
    }
  }
  return locked;
}

/**
 * §3.4 tie-break: among the locked cells pick the removal target by piece removal
 * frequency so far — the **lowest** frequency when `size > 4`, the **highest** when
 * `size <= 4` (deliberately different for small vs. larger boards; preserve as-is). Ties
 * resolve to the first in row-major order. This is the single strategy; the four-tier
 * Easy/Medium/Hard/Expert difficulty design in the original is aspirational and NOT
 * implemented here (§8.3).
 */
export function pickNextLockedCell(
  locked: readonly Cell[],
  board: Board,
  size: number,
  removalFreq: ReadonlyMap<Piece, number>,
): Cell | undefined {
  if (locked.length === 0) return undefined;
  const preferLowest = size > 4;
  let target = preferLowest ? Infinity : -Infinity;
  let best: Cell | undefined;
  for (const [row, col] of locked) {
    const piece = board[row][col];
    if (piece === null) continue;
    const f = removalFreq.get(piece) ?? 0;
    if (preferLowest ? f < target : f > target) {
      target = f;
      best = [row, col];
    }
  }
  return best;
}

/** For a single blank cell, return the tray pieces that legally fit it. */
function computeFitsForCell(
  board: Board,
  trayPieces: readonly Piece[],
  r: number,
  c: number,
): Piece[] {
  const fits: Piece[] = [];
  for (const p of trayPieces) {
    if (fitsBlankCell(board, p, r, c)) fits.push(p);
  }
  return fits;
}

/**
 * §3.4 / §3.5 step 5: (re)compute both fit caches against the given board + remaining
 * tray, restricted to tray-piece-values and blank-cells (the two are inverses). Returns
 * fresh maps; the input board/tray are not mutated.
 */
export function recomputeFitCaches(
  board: Board,
  size: number,
  trayPieces: readonly Piece[],
): Readonly<{
  pieceToFitCells: PieceFitCache;
  cellToFitPieces: CellFitCache;
}> {
  const pieceToFit = new Map<Piece, number[]>();
  for (const p of trayPieces) pieceToFit.set(p, []);

  const cellToFit = new Map<number, Piece[]>();

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== null) continue;
      const idx = cellIndex(size, r, c);
      const fits = computeFitsForCell(board, trayPieces, r, c);
      cellToFit.set(idx, fits);
      for (const p of fits) pieceToFit.get(p)?.push(idx);
    }
  }

  // Freshly-built maps, read-only from this point onward (§7.3). The `Map` values
  // (`Piece[]`/`number[]`) are assignable to the `readonly *[]` cache types; nothing
  // reuses or mutates them after this call.
  return {
    pieceToFitCells: pieceToFit,
    cellToFitPieces: cellToFit,
  };
}

/**
 * §3.4: unfold a fully-solved `Board` into a playable puzzle. Repeatedly blank locked
 * cells (those that no tray piece can replace and that are not an isolation point),
 * picking the next removal by the size-dependent frequency tie-break, until no locked
 * cell remains. The removed pieces become the tray; both fit caches are then computed.
 *
 * The input board is not mutated. Returns a `Game` with an empty `placedCells` (no move
 * has been played yet) and the given `preferences` seeded on.
 */
export function unfoldGame(board: Board, preferences: GamePreferences): Game {
  const size = board.length;
  // Mutable working copy: fresh row arrays over the (immutable, shared) piece refs.
  const draft = board.map((row) => row.slice());
  const tray = new Map<Piece, number>();
  const removalFreq = new Map<Piece, number>();

  for (;;) {
    const trayPieces = [...tray.keys()];
    const locked = lockedCells(draft, size, trayPieces);
    const next = pickNextLockedCell(locked, draft, size, removalFreq);
    if (next === undefined) break;

    const [row, col] = next;
    const piece = draft[row][col];
    if (piece === null) break; // unreachable: pickNextLockedCell only yields filled cells
    draft[row][col] = null;
    tray.set(piece, (tray.get(piece) ?? 0) + 1);
    removalFreq.set(piece, (removalFreq.get(piece) ?? 0) + 1);
  }

  // Deep-freeze the resulting board (fresh frozen rows; piece refs are already shared).
  const finalBoard = draft.map((row) => Object.freeze(row.slice())) as Board;
  const trayPieces = [...tray.keys()];
  const { pieceToFitCells, cellToFitPieces } = recomputeFitCaches(
    finalBoard,
    size,
    trayPieces,
  );

  return {
    size,
    board: finalBoard,
    availablePieces: tray,
    placedCells: NO_MOVES,
    pieceToFitCells,
    cellToFitPieces,
    preferences,
  };
}

/**
 * §3.5: place `pieceValue` into `cell`. Order of operations is fixed:
 *   1. read legality from the *current* `pieceToFitCells` cache;
 *   2. if invalid and `preventInvalidMoves`, throw before touching any state;
 *   3. decrement the tray count (drop the entry at zero);
 *   4. write the piece into a fresh copy of the board;
 *   5. recompute both fit caches against the new board + tray;
 *   6. append the `Move` to `placedCells`.
 *
 * Returns a new `Game`; the input `game` is not mutated. When the move is invalid and
 * `preventInvalidMoves` is `false`, it is still applied and recorded with
 * `isValid: false` (a caller-supplied invalid move leaves the board intentionally
 * inconsistent; the fit caches are recomputed against that state).
 */
export function placePiece(pieceValue: Piece, cell: Cell, game: Game): Game {
  const { size, board, availablePieces, placedCells, preferences } = game;
  const [row, col] = cell;
  const idx = cellIndex(size, row, col);

  // §3.5 step 1: legality against the CURRENT cache, computed before any mutation.
  const candidateCells = game.pieceToFitCells.get(pieceValue) ?? [];
  const isValid = candidateCells.includes(idx);

  // §3.5 step 2: guard — surface to the caller via a throw; no state is touched.
  if (!isValid && preferences.preventInvalidMoves) {
    throw new Error(
      `placePiece: invalid move — piece cannot legally occupy cell [${row}, ${col}]`,
    );
  }

  // §3.5 step 3: decrement the tray count, dropping the entry at zero.
  const nextTray = new Map(availablePieces);
  const count = nextTray.get(pieceValue);
  if (count === undefined || count <= 1) nextTray.delete(pieceValue);
  else nextTray.set(pieceValue, count - 1);

  // §3.5 step 4: write the piece into a fresh board (only the target row is re-frozen).
  const nextBoard = board.map((r, rr) =>
    rr === row
      ? Object.freeze(r.map((v, cc) => (cc === col ? pieceValue : v)))
      : r,
  ) as Board;

  // §3.5 step 5: recompute both caches against the new board + tray.
  const trayPieces = [...nextTray.keys()];
  const { pieceToFitCells, cellToFitPieces } = recomputeFitCaches(
    nextBoard,
    size,
    trayPieces,
  );

  // §3.5 step 6: record the move (immutably appended).
  const move = Object.freeze({ pieceValue, cell, isValid });
  const nextPlaced = Object.freeze([...placedCells, move]);

  return {
    size,
    board: nextBoard,
    availablePieces: nextTray,
    placedCells: nextPlaced,
    pieceToFitCells,
    cellToFitPieces,
    preferences,
  };
}

/**
 * §3.5 / §8.4: undo the most recent move. Pops the last `Move`, restores its piece to the
 * tray, blanks its cell, and recomputes both fit caches.
 *
 * Deliberately NO guard against an empty `placedCells`: `placedCells.at(-1)` returns
 * `undefined` past the end and the destructuring below throws, exactly as in the
 * original. The UI disables Undo when `placedCells` is empty (§5.7), so this path is
 * unreachable in normal play; we reproduce the unhandled behavior rather than adding a
 * defensive check (§8.4).
 */
export function undoPlay(game: Game): Game {
  const { size, board, availablePieces, placedCells, preferences } = game;
  const last = placedCells.at(-1)!;
  const { pieceValue, cell } = last;
  const [row, col] = cell;

  const nextTray = new Map(availablePieces);
  nextTray.set(pieceValue, (nextTray.get(pieceValue) ?? 0) + 1);

  const nextBoard = board.map((r, rr) =>
    rr === row ? Object.freeze(r.map((v, cc) => (cc === col ? null : v))) : r,
  ) as Board;

  const nextPlaced = Object.freeze(placedCells.slice(0, -1));

  const trayPieces = [...nextTray.keys()];
  const { pieceToFitCells, cellToFitPieces } = recomputeFitCaches(
    nextBoard,
    size,
    trayPieces,
  );

  return {
    size,
    board: nextBoard,
    availablePieces: nextTray,
    placedCells: nextPlaced,
    pieceToFitCells,
    cellToFitPieces,
    preferences,
  };
}

/**
 * §3.6: the game state is valid iff all four hold simultaneously:
 *   1. every recorded move so far is `isValid: true`;
 *   2. every blank cell has at least one tray piece that could fit it;
 *   3. every remaining tray piece has at least one blank cell it could fit;
 *   4. the number of blank cells equals the number of remaining tray pieces (guard
 *      against vacuous-truth edge cases where the board or tray is miscounted).
 * (The original §3.6 `gameIsSolvable` is the three-condition form; this four-condition
 * `stateIsValid` adds the blank-vs-tray cardinality guard per the phase-03 spec.)
 */
export function stateIsValid(game: Game): boolean {
  const {
    size,
    board,
    availablePieces,
    placedCells,
    pieceToFitCells,
    cellToFitPieces,
  } = game;

  // (1) every placed move is valid.
  for (const m of placedCells) {
    if (!m.isValid) return false;
  }

  // (2) every blank cell has >=1 fitting piece + count blanks.
  let blanks = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== null) continue;
      blanks++;
      const fits = cellToFitPieces.get(cellIndex(size, r, c));
      if (fits === undefined || fits.length === 0) return false;
    }
  }

  // (3) every remaining tray piece has >=1 fitting cell + count remaining units.
  let remaining = 0;
  for (const [piece, count] of availablePieces) {
    remaining += count;
    const cells = pieceToFitCells.get(piece);
    if (cells === undefined || cells.length === 0) return false;
  }

  // (4) blank cells === remaining tray units.
  return blanks === remaining;
}
