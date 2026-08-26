import { buildBoard } from "../game/boardBuilder";
import { createPiece } from "../game/entities";
import { cellFromIndex, placePiece, type Game } from "../game/gameBuilder";

/**
 * A real finished, solvable position: `game` played to a natural end through the
 * shared move-engine path (`placePiece` — every recorded move is `isValid: true`
 * by construction, `preventInvalidMoves` is on, so any illegal placement would
 * have thrown instead of being recorded). The seed-42 fixture's unfolded game
 * always completes this greedy cache walk (7 moves, verified empirically — a
 * real, not hand-authored, finished game).
 */
export function playToCompletion(game: Game): Game {
  let current = game;
  while (current.availablePieces.size > 0) {
    let next: Game | null = null;
    for (const [piece, cells] of current.pieceToFitCells) {
      for (const idx of cells) {
        try {
          next = placePiece(piece, cellFromIndex(current.size, idx), current);
          break;
        } catch {
          /* the cell may no longer fit after a sibling placement; keep looking */
        }
      }
      if (next !== null) break;
    }
    if (next === null)
      throw new Error(
        "fixture: the seed-42 game stalled mid-play (impossible)",
      );
    current = next;
  }
  return current;
}

/**
 * A finished position that is NOT solvable: the board fully re-filled (no blanks,
 * empty tray — so §3.6's conditions 2–4 all hold vacuously) with one recorded
 * move flagged `isValid: false` — condition 1 fails, and it fails alone, so this
 * isolates the "every placed move is valid" clause of `gameIsSolvable`.
 */
export function buildUnsolvableFinishedGame(): Game {
  const board = buildBoard(4, 3, 3, 42);
  return {
    size: 4,
    board,
    availablePieces: new Map(),
    placedCells: Object.freeze([
      Object.freeze({
        pieceValue: createPiece([0, 0, 0], 3, 3),
        cell: [0, 0] as const,
        isValid: false,
      }),
    ]),
    pieceToFitCells: new Map(),
    cellToFitPieces: new Map(),
    preferences: { preventInvalidMoves: true },
  };
}
