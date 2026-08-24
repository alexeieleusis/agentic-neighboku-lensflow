import { describe, expect, it } from "vitest";
import type { AppState } from "../App.types";
import { cellDroppableId } from "../components/CellDisplay/useCellDisplayDomain";
import { trayPieceDraggableId } from "../components/DraggablePiece/useDraggablePieceDomain";
import { buildPiecePool, buildBoard } from "../game/boardBuilder";
import type { Piece } from "../game/entities";
import {
  cellFromIndex,
  cellIndex,
  unfoldGame,
  type Cell,
  type Game,
} from "../game/gameBuilder";
import {
  buildAvailablePiecesTrayState,
  buildBoardDisplayState,
  resolveDragDrop,
  resolveTrayPiece,
} from "../useAppDomain";

/**
 * A real, freshly-unfolded game (never a hand-authored fixture, per the shell's own
 * convention): a deterministic Phase 2 board (seed fixed) through Phase 3's unfolding.
 */
const GAME_SEED = 42;

function buildGame(preventInvalidMoves = true): Game {
  return unfoldGame(buildBoard(4, 3, 3, GAME_SEED), { preventInvalidMoves });
}

function buildState(game: Game): AppState {
  return {
    game,
    preferences: {
      scalars: { base: 3, dimension: 3, size: 4 },
      pieceType: "Shapes",
      hints: {
        fitPieceCount: false,
        pieceCells: false,
        fitOnDrag: false,
        showFitPiecesOnHover: false,
        availablePiecesCount: false,
        availablePieceUniqueCell: false,
        gameIsSolvable: false,
      },
      preventInvalidMoves: game.preferences.preventInvalidMoves,
      sound: false,
    },
    invalidMoveSnackbarOpen: false,
    gameFinishedDialogOpen: false,
  };
}

/** A guaranteed-legal (piece, blank cell) pair, read straight off the fit cache. */
function pickLegalPlacement(game: Game): readonly [Piece, Cell] {
  for (const [piece, cells] of game.pieceToFitCells) {
    if (cells.length > 0) {
      return [piece, cellFromIndex(game.size, cells[0])];
    }
  }
  throw new Error("fixture: unfolded game has no legal placement (impossible)");
}

/**
 * A (piece, blank cell) pair where the piece does NOT legally fit the cell — or
 * `null` if the fixture has no such pair. The piece must be one the tray still holds
 * (otherwise the drop is rejected by tray lookup long before the fit check).
 */
function pickIllegalPlacement(game: Game): readonly [Piece, Cell] | null {
  for (const [piece, count] of game.availablePieces) {
    if (count === 0) continue;
    for (const idx of game.cellToFitPieces.keys()) {
      const fits = game.cellToFitPieces.get(idx) ?? [];
      if (!fits.includes(piece)) {
        return [piece, cellFromIndex(game.size, idx)];
      }
    }
  }
  return null;
}

/** Fixture invariant: fit-cache keys are derived from the tray, so an entry exists. */
function trayCount(game: Game, piece: Piece): number {
  const count = game.availablePieces.get(piece);
  if (count === undefined) {
    throw new Error(
      "fixture: piece from fit cache missing from tray (impossible)",
    );
  }
  return count;
}

describe("useAppDomain (§5.6 drag-drop resolution)", () => {
  it("commits a legal drop through placePiece: board filled, tray decremented, move recorded", () => {
    const state = buildState(buildGame());
    const [piece, [row, col]] = pickLegalPlacement(state.game);
    const targetIdx = cellIndex(state.game.size, row, col);
    const trayBefore = trayCount(state.game, piece);

    const next = resolveDragDrop(state, {
      activeId: trayPieceDraggableId(piece),
      overId: cellDroppableId(row, col),
    });

    expect(next).not.toBe(state);
    expect(next.game).not.toBe(state.game);
    // The board cell now holds exactly the interned piece that was dragged.
    expect(next.game.board[row][col]).toBe(piece);
    // The tray decremented (or dropped the value at zero).
    const trayAfter = next.game.availablePieces.get(piece);
    if (trayBefore > 1) expect(trayAfter).toBe(trayBefore - 1);
    else expect(trayAfter).toBeUndefined();
    // The move was recorded on the same path click-to-place will use.
    expect(next.game.placedCells).toHaveLength(
      state.game.placedCells.length + 1,
    );
    const move = next.game.placedCells.at(-1)!;
    expect(move.isValid).toBe(true);
    expect(move.cell).toEqual([row, col]);
    expect(move.pieceValue).toBe(piece);
    // The fit caches follow the new board: the target is no longer a fit cell.
    expect(next.game.cellToFitPieces.get(targetIdx)).toBeUndefined();
    for (const remaining of next.game.availablePieces.keys()) {
      expect(next.game.pieceToFitCells.get(remaining)).toBeDefined();
    }
  });

  it("does not mutate the input state (new objects only, §7.3)", () => {
    const state = buildState(buildGame());
    const [piece, [row, col]] = pickLegalPlacement(state.game);

    const next = resolveDragDrop(state, {
      activeId: trayPieceDraggableId(piece),
      overId: cellDroppableId(row, col),
    });

    expect(state.game.board[row][col]).toBeNull();
    expect(state.game.placedCells).toHaveLength(0);
    expect(state.game).not.toBe(next.game);
  });

  it("is a no-op when dropped outside any droppable (event.over is null)", () => {
    const state = buildState(buildGame());
    const [piece] = pickLegalPlacement(state.game);

    const next = resolveDragDrop(state, {
      activeId: trayPieceDraggableId(piece),
      overId: null,
    });

    expect(next).toBe(state);
  });

  it("is a no-op when the drop target id is not a cell", () => {
    const state = buildState(buildGame());
    const [piece] = pickLegalPlacement(state.game);

    for (const overId of ["piece-0-0", "garbage", ""]) {
      const next = resolveDragDrop(state, {
        activeId: trayPieceDraggableId(piece),
        overId,
      });
      expect(next).toBe(state);
    }
  });

  it("is a no-op when the dragged id is not a piece the tray holds", () => {
    const state = buildState(buildGame());
    const [, cell] = pickLegalPlacement(state.game);

    // Digits no tray entry matches (resolveTrayPiece finds nothing) → no-op.
    const stray = pickStrayPiece(state.game);
    const next = resolveDragDrop(state, {
      activeId: trayPieceDraggableId(stray),
      overId: cellDroppableId(cell[0], cell[1]),
    });
    expect(next).toBe(state);

    // And a fully unparseable active id → no-op.
    expect(
      resolveDragDrop(state, {
        activeId: "nope",
        overId: cellDroppableId(0, 0),
      }),
    ).toBe(state);
  });

  it("absorbs the move engine's invalid-move throw: state unchanged, no crash", () => {
    const state = buildState(buildGame());

    // Out-of-bounds cell: parses as a cell id, placePiece rejects it at its domain
    // boundary (§3.5 precondition) before touching any state.
    const [piece] = pickLegalPlacement(state.game);
    expect(
      resolveDragDrop(state, {
        activeId: trayPieceDraggableId(piece),
        overId: cellDroppableId(state.game.size, 0),
      }),
    ).toBe(state);

    // In-range but not a legal cell for that piece, with preventInvalidMoves on:
    // placePiece throws (§3.5 step 2, before any mutation) and the drop is a no-op.
    const illegal = pickIllegalPlacement(state.game);
    expect(illegal).not.toBeNull();
    const [badPiece, badCell] = illegal!;
    expect(
      resolveDragDrop(state, {
        activeId: trayPieceDraggableId(badPiece),
        overId: cellDroppableId(badCell[0], badCell[1]),
      }),
    ).toBe(state);
  });
});

describe("resolveTrayPiece (§8.7 reference resolution)", () => {
  it("finds the tray's interned piece reference, not an equal new array", () => {
    const game = buildGame();
    const [piece] = pickLegalPlacement(game);
    expect(resolveTrayPiece(game, [...piece])).toBe(piece);
    expect(resolveTrayPiece(game, null)).toBeNull();
    // Digits matching no tray value resolve to null (the drop then no-ops).
    const stray = pickStrayPiece(game);
    expect(resolveTrayPiece(game, [...stray])).toBeNull();
  });
});

describe("shell state-slice builders (moved from App.tsx)", () => {
  it("buildBoardDisplayState flattens the board into rows of cells", () => {
    const game = buildGame();
    const slice = buildBoardDisplayState(game, "Shapes");
    expect(slice.size).toBe(4);
    expect(slice.rows).toHaveLength(4);
    expect(slice.rows.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    expect(slice.rows[1].cells.map((c) => c.col)).toEqual([0, 1, 2, 3]);
    expect(slice.rows[1].cells[2]).toEqual({
      row: 1,
      col: 2,
      piece: game.board[1][2],
    });
  });

  it("buildAvailablePiecesTrayState mirrors the move engine's remaining tray", () => {
    const game = buildGame();
    expect(buildAvailablePiecesTrayState(game)).toEqual({
      size: game.size,
      availablePieces: game.availablePieces,
    });
  });
});

/** A piece value the fixture's tray demonstrably does not hold. */
function pickStrayPiece(game: Game): Piece {
  for (const candidate of buildPiecePool(3, 3)) {
    if (!game.availablePieces.has(candidate)) return candidate;
  }
  throw new Error("fixture: tray holds the whole pool (impossible)");
}
