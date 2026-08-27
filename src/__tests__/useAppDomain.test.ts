import { describe, expect, it } from "vitest";
import type { AppPreferences, AppState } from "../App.types";
import { cellDroppableId } from "../components/CellDisplay/useCellDisplayDomain";
import { trayPieceDraggableId } from "../components/DraggablePiece/useDraggablePieceDomain";
import { buildPiecePool, buildBoard } from "../game/boardBuilder";
import type { Piece } from "../game/entities";
import {
  cellFromIndex,
  cellIndex,
  placePiece,
  stateIsValid,
  unfoldGame,
  type Cell,
  type Game,
} from "../game/gameBuilder";
import {
  buildAvailablePiecesTrayState,
  buildBoardDisplayState,
  buildSolvabilityIconState,
  closeInvalidMoveSnackbar,
  formatElapsed,
  isTrayEmpty,
  mergeStoredPreferences,
  resolveDragDrop,
  resolveDragHint,
  resolveTrayPiece,
  type JsonValue,
} from "../useAppDomain";
import { buildUnsolvableFinishedGame, playToCompletion } from "./fixtures";

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
    // The domain functions under test here never read the clock; the value is
    // an inert fixture placeholder.
    gamePlay: { startTime: 0 },
    invalidMoveSnackbarOpen: false,
    dragHint: "None",
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
 * A (piece, blank cell) pair where the piece does NOT legally fit the cell. The piece
 * must be one the tray still holds (otherwise the drop is rejected by tray lookup
 * long before the fit check).
 */
function pickIllegalPlacement(game: Game): readonly [Piece, Cell] {
  for (const [piece, count] of game.availablePieces) {
    if (count === 0) continue;
    for (const idx of game.cellToFitPieces.keys()) {
      const fits = game.cellToFitPieces.get(idx) ?? [];
      if (!fits.includes(piece)) {
        return [piece, cellFromIndex(game.size, idx)];
      }
    }
  }
  throw new Error(
    "fixture: unfolded game has no illegal placement (impossible)",
  );
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
    const move = next.game.placedCells.at(-1);
    if (move === undefined)
      throw new Error("expected a recorded move after a legal drop");
    expect(move.isValid).toBe(true);
    expect(move.cell).toEqual([row, col]);
    expect(move.pieceValue).toBe(piece);
    // The fit caches follow the new board: the target is no longer a fit cell.
    expect(next.game.cellToFitPieces.get(targetIdx)).toBeUndefined();
    for (const remaining of next.game.availablePieces.keys()) {
      expect(next.game.pieceToFitCells.get(remaining)).toBeDefined();
    }
    // A legal placement never opens the invalid-move feedback (§5.12).
    expect(next.invalidMoveSnackbarOpen).toBe(false);
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

  it("absorbs the move engine's invalid-move throw: opens the feedback, game untouched, no crash", () => {
    const state = buildState(buildGame());

    // Out-of-bounds cell: parses as a cell id, placePiece rejects it at its domain
    // boundary (§3.5 precondition) before touching any state.
    const [piece] = pickLegalPlacement(state.game);
    const oob = resolveDragDrop(state, {
      activeId: trayPieceDraggableId(piece),
      overId: cellDroppableId(state.game.size, 0),
    });
    expect(oob).not.toBe(state);
    expect(oob.invalidMoveSnackbarOpen).toBe(true);
    // §5.12: the rejection changes nothing but the feedback — the engine state is the
    // very same object placePiece refused to mutate.
    expect(oob.game).toBe(state.game);
    expect(state.game.placedCells).toHaveLength(0);

    // In-range but not a legal cell for that piece, with preventInvalidMoves on:
    // placePiece throws (§3.5 step 2, before any mutation) and the same feedback opens.
    const [badPiece, badCell] = pickIllegalPlacement(state.game);
    const rejected = resolveDragDrop(state, {
      activeId: trayPieceDraggableId(badPiece),
      overId: cellDroppableId(badCell[0], badCell[1]),
    });
    expect(rejected.invalidMoveSnackbarOpen).toBe(true);
    expect(rejected.game).toBe(state.game);
    expect(state.game.board[badCell[0]][badCell[1]]).toBeNull();
    expect(state.game.placedCells).toHaveLength(0);
  });

  it("commits an invalid move when preventInvalidMoves is off (§3.5: applied, recorded isValid: false) and never opens the feedback", () => {
    const state = buildState(buildGame(false));
    expect(state.game.preferences.preventInvalidMoves).toBe(false);
    const [badPiece, badCell] = pickIllegalPlacement(state.game);
    const next = resolveDragDrop(state, {
      activeId: trayPieceDraggableId(badPiece),
      overId: cellDroppableId(badCell[0], badCell[1]),
    });
    expect(next).not.toBe(state);
    expect(next.game.board[badCell[0]][badCell[1]]).toBe(badPiece);
    const move = next.game.placedCells.at(-1);
    if (move === undefined)
      throw new Error("expected a recorded move after an invalid drop");
    expect(move.isValid).toBe(false);
    // No throw, no feedback: §5.12 fires only on a rejected attempt.
    expect(next.invalidMoveSnackbarOpen).toBe(false);
  });

  it("treats a drop onto a filled cell as a rejected placement: opens the feedback, game untouched (§3.5 step 1)", () => {
    const state = buildState(buildGame());
    const [piece] = pickLegalPlacement(state.game);
    const [row, col] = pickFilledCell(state.game);

    // Filled cells never appear in the fit caches, so the placement reads as
    // invalid, placePiece throws before any mutation, and the shell opens the
    // invalid-move feedback exactly as for any other rejected attempt (§5.12).
    const next = resolveDragDrop(state, {
      activeId: trayPieceDraggableId(piece),
      overId: cellDroppableId(row, col),
    });

    expect(next).not.toBe(state);
    expect(next.invalidMoveSnackbarOpen).toBe(true);
    expect(next.game).toBe(state.game);
    expect(state.game.placedCells).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Phase 14 — §5.6 drag-fit hint state machine                                 */
/* -------------------------------------------------------------------------- */

/** A `buildState` with the §4.2 `hintFitOnDrag` preference flipped on. */
function buildStateWithFitOnDrag(game: Game): AppState {
  const state = buildState(game);
  return {
    ...state,
    preferences: {
      ...state.preferences,
      hints: { ...state.preferences.hints, fitOnDrag: true },
    },
  };
}

describe("resolveDragHint (§5.6 / Phase 14 drag-fit hint state machine)", () => {
  it("start: a drag in progress with no hovered target yet is `Unknown`", () => {
    const state = buildStateWithFitOnDrag(buildGame());
    expect(resolveDragHint(state, { kind: "start" })).toBe("Unknown");
    // Independent of the preference — the hint is undetermined until a target is
    // hovered, regardless of `hintFitOnDrag`.
    expect(resolveDragHint(buildState(buildGame()), { kind: "start" })).toBe(
      "Unknown",
    );
  });

  it("end / cancel: no drag in progress anymore is `None`", () => {
    const state = buildStateWithFitOnDrag(buildGame());
    expect(resolveDragHint(state, { kind: "end" })).toBe("None");
    expect(resolveDragHint(state, { kind: "cancel" })).toBe("None");
  });

  it("over with no hovered target (`overId` null) is `Unknown`, even with the preference on", () => {
    const [piece] = pickLegalPlacement(buildGame());
    const state = buildStateWithFitOnDrag(buildGame());
    expect(
      resolveDragHint(state, {
        kind: "over",
        activeId: trayPieceDraggableId(piece),
        overId: null,
      }),
    ).toBe("Unknown");
  });

  it("over a legal target with `hintFitOnDrag` on is `Ok`", () => {
    const game = buildGame();
    const [piece, [row, col]] = pickLegalPlacement(game);
    const state = buildStateWithFitOnDrag(game);
    expect(
      resolveDragHint(state, {
        kind: "over",
        activeId: trayPieceDraggableId(piece),
        overId: cellDroppableId(row, col),
      }),
    ).toBe("Ok");
  });

  it("over a target that is not a legal placement with `hintFitOnDrag` on is `NotOk`", () => {
    const game = buildGame();
    const [piece, cell] = pickIllegalPlacement(game);
    const state = buildStateWithFitOnDrag(game);
    expect(
      resolveDragHint(state, {
        kind: "over",
        activeId: trayPieceDraggableId(piece),
        overId: cellDroppableId(cell[0], cell[1]),
      }),
    ).toBe("NotOk");
  });

  it("over a target with `hintFitOnDrag` off is `Unknown` (never Ok/NotOk)", () => {
    const game = buildGame();
    const [piece, [row, col]] = pickLegalPlacement(game);
    // fitOnDrag is false in the plain buildState.
    const state = buildState(game);
    expect(
      resolveDragHint(state, {
        kind: "over",
        activeId: trayPieceDraggableId(piece),
        overId: cellDroppableId(row, col),
      }),
    ).toBe("Unknown");
    // …and an illegal target is equally undetermined, not `NotOk`.
    const [badPiece, badCell] = pickIllegalPlacement(game);
    expect(
      resolveDragHint(state, {
        kind: "over",
        activeId: trayPieceDraggableId(badPiece),
        overId: cellDroppableId(badCell[0], badCell[1]),
      }),
    ).toBe("Unknown");
  });

  it("over a target whose id does not parse as a cell is `Unknown`", () => {
    const game = buildGame();
    const [piece] = pickLegalPlacement(game);
    const state = buildStateWithFitOnDrag(game);
    for (const overId of ["piece-0-0", "garbage", ""]) {
      expect(
        resolveDragHint(state, {
          kind: "over",
          activeId: trayPieceDraggableId(piece),
          overId,
        }),
      ).toBe("Unknown");
    }
  });

  it("over an out-of-bounds cell id is `Unknown` (not a registered droppable)", () => {
    const game = buildGame();
    const [piece] = pickLegalPlacement(game);
    const state = buildStateWithFitOnDrag(game);
    // Parses as a cell, but lies beyond the board — placePiece's own §3.5
    // precondition would reject it, so the hint stays undetermined.
    expect(
      resolveDragHint(state, {
        kind: "over",
        activeId: trayPieceDraggableId(piece),
        overId: cellDroppableId(game.size, 0),
      }),
    ).toBe("Unknown");
  });

  it("with an active id that does not resolve to a tray piece is `Unknown`", () => {
    const game = buildGame();
    const [, [row, col]] = pickLegalPlacement(game);
    const state = buildStateWithFitOnDrag(game);
    // Digits no tray entry matches.
    const stray = pickStrayPiece(game);
    expect(
      resolveDragHint(state, {
        kind: "over",
        activeId: trayPieceDraggableId(stray),
        overId: cellDroppableId(row, col),
      }),
    ).toBe("Unknown");
    // …and a fully unparseable active id.
    expect(
      resolveDragHint(state, {
        kind: "over",
        activeId: "nope",
        overId: cellDroppableId(row, col),
      }),
    ).toBe("Unknown");
  });
});

describe("closeInvalidMoveSnackbar (§5.12 dismissal)", () => {
  it("closes open feedback: new state object, game reference untouched", () => {
    const state = buildState(buildGame());
    const open = { ...state, invalidMoveSnackbarOpen: true };

    const next = closeInvalidMoveSnackbar(open);
    expect(next).not.toBe(open);
    expect(next.invalidMoveSnackbarOpen).toBe(false);
    expect(next.game).toBe(open.game);
  });

  it("is a no-op when the feedback is already closed (input reference, no re-emission)", () => {
    const state = buildState(buildGame());
    expect(closeInvalidMoveSnackbar(state)).toBe(state);
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

/* -------------------------------------------------------------------------- */
/* Phase 15 — §3.6/§5.13 game-finished & solvability-indicator derivations      */
/* -------------------------------------------------------------------------- */

describe("isTrayEmpty (§3.6 / Phase 15 finished-game trigger)", () => {
  it("a freshly-unfolded game is not finished (the tray holds pieces)", () => {
    expect(isTrayEmpty(buildGame())).toBe(false);
  });

  it("a naturally-played-to-completion game is finished", () => {
    expect(isTrayEmpty(playToCompletion(buildGame()))).toBe(true);
  });

  it("is the tray's `availablePieces.size === 0`, the §3.6 literal — at any point in the game", () => {
    const game = buildGame();
    // A mid-game state (one piece placed) is not finished, and tracks the size literal.
    const [piece, [row, col]] = pickLegalPlacement(game);
    const onePlaced = placePiece(piece, [row, col], game);
    expect(onePlaced.availablePieces.size).toBeGreaterThan(0);
    expect(isTrayEmpty(onePlaced)).toBe(onePlaced.availablePieces.size === 0);
    // A finished state holds the literal true.
    const finished = playToCompletion(game);
    expect(finished.availablePieces.size).toBe(0);
    expect(isTrayEmpty(finished)).toBe(true);
  });
});

describe("formatElapsed (§5.13 / Phase 15 elapsed-time string)", () => {
  it("formats exactly `{h}h {m}m {s}s` with no padding", () => {
    expect(formatElapsed(0)).toBe("0h 0m 0s");
    expect(formatElapsed(999)).toBe("0h 0m 0s"); // truncated to the whole second
    expect(formatElapsed(85_500)).toBe("0h 1m 25s");
    expect(formatElapsed(3_661_000)).toBe("1h 1m 1s");
    expect(formatElapsed(7_335_000)).toBe("2h 2m 15s");
    expect(formatElapsed(36_000_000)).toBe("10h 0m 0s");
  });

  it("truncates (never rounds up) sub-second remainders", () => {
    expect(formatElapsed(59_999)).toBe("0h 0m 59s");
    expect(formatElapsed(3_599_999)).toBe("0h 59m 59s");
  });

  it("clamps a negative duration to zero", () => {
    expect(formatElapsed(-1)).toBe("0h 0m 0s");
    expect(formatElapsed(-86_400_000)).toBe("0h 0m 0s");
  });
});

describe("buildSolvabilityIconState (§5.13 / Phase 15 App → SolvabilityIcon slice)", () => {
  it("projects the §4.2 preference onto `visible` verbatim", () => {
    const game = buildGame();
    expect(buildSolvabilityIconState(game, false).visible).toBe(false);
    expect(buildSolvabilityIconState(game, true).visible).toBe(true);
  });

  it("consumes Phase 3's `stateIsValid` result verbatim — it does not recompute solvability", () => {
    const cases: readonly [Game, boolean][] = [
      // A fresh position is solvable (every §3.6 condition holds on an unfold).
      [buildGame(), true],
      // A naturally-finished position is solvable (every move was valid).
      [playToCompletion(buildGame()), true],
      // The isolated invalid-move position is not.
      [buildUnsolvableFinishedGame(), false],
    ];
    for (const [game, solvable] of cases) {
      expect(stateIsValid(game)).toBe(solvable);
      // The slice's `solvable` is the move engine's own result — identical at
      // either preference setting (the preference drives `visible`, not it).
      expect(buildSolvabilityIconState(game, true).solvable).toBe(
        stateIsValid(game),
      );
      expect(buildSolvabilityIconState(game, false).solvable).toBe(solvable);
    }
  });
});

describe("shell state-slice builders (moved from App.tsx)", () => {
  it("buildBoardDisplayState flattens the board into rows of cells", () => {
    const game = buildGame();
    const slice = buildBoardDisplayState(game, buildState(game).preferences);
    expect(slice.size).toBe(4);
    expect(slice.rows).toHaveLength(4);
    expect(slice.rows.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    expect(slice.rows[1].cells.map((c) => c.col)).toEqual([0, 1, 2, 3]);
    expect(slice.rows[1].cells[2]).toEqual({
      row: 1,
      col: 2,
      piece: game.board[1][2],
    });
    expect(slice.pieceType).toBe("Shapes");
    expect(slice.cellToFitPieces).toBe(game.cellToFitPieces);
    expect(slice.hintFitPieceCount).toBe(false);
    expect(slice.showFitPiecesOnHover).toBe(false);
  });

  it("buildBoardDisplayState forwards hint preferences from preferences.hints", () => {
    const game = buildGame();
    const state = buildState(game);
    const prefs = {
      ...state.preferences,
      hints: {
        ...state.preferences.hints,
        fitPieceCount: true,
        showFitPiecesOnHover: true,
      },
    };
    const slice = buildBoardDisplayState(game, prefs);
    expect(slice.pieceType).toBe("Shapes");
    expect(slice.cellToFitPieces).toBe(game.cellToFitPieces);
    expect(slice.hintFitPieceCount).toBe(true);
    expect(slice.showFitPiecesOnHover).toBe(true);
  });

  it("buildAvailablePiecesTrayState carries the whole game plus the tray-scoped hint flags", () => {
    // Phase 13: the tray renders `game`'s tray/fit-cache fields and commits its
    // click-to-place through `placePiece` (which needs the whole game), so the slice
    // carries the entire `Game` — not a picked few fields — plus the two §4.2 flags
    // the columns gate their `*` / button list on.
    const game = buildGame();
    expect(
      buildAvailablePiecesTrayState(game, {
        availablePieceUniqueCell: true,
        pieceCells: false,
      }),
    ).toEqual({
      game,
      availablePieceUniqueCell: true,
      pieceCells: false,
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Phase 16 — §4.3/§8.5 stored-preferences reconciliation                      */
/* -------------------------------------------------------------------------- */

/** The §4.2 defaults, as `main.tsx` holds them (the merge base). */
const PREFERENCE_DEFAULTS = {
  scalars: { base: 3, dimension: 3, size: 6 },
  pieceType: "Shapes",
  hints: {
    fitPieceCount: true,
    pieceCells: false,
    fitOnDrag: true,
    showFitPiecesOnHover: true,
    availablePiecesCount: true,
    availablePieceUniqueCell: true,
    gameIsSolvable: true,
  },
  preventInvalidMoves: true,
  sound: true,
} satisfies AppPreferences;

describe("useAppDomain (§4.3/§8.5 mergeStoredPreferences)", () => {
  it("returns the §4.2 defaults verbatim when nothing is stored", () => {
    expect(mergeStoredPreferences(PREFERENCE_DEFAULTS, undefined)).toEqual(
      PREFERENCE_DEFAULTS,
    );
    expect(mergeStoredPreferences(PREFERENCE_DEFAULTS, null)).toEqual(
      PREFERENCE_DEFAULTS,
    );
    expect(mergeStoredPreferences(PREFERENCE_DEFAULTS, {})).toEqual(
      PREFERENCE_DEFAULTS,
    );
  });

  it("treats a non-object stored blob (string, number, array) as 'no stored preferences'", () => {
    expect(mergeStoredPreferences(PREFERENCE_DEFAULTS, "garbage")).toEqual(
      PREFERENCE_DEFAULTS,
    );
    expect(mergeStoredPreferences(PREFERENCE_DEFAULTS, 42)).toEqual(
      PREFERENCE_DEFAULTS,
    );
    expect(mergeStoredPreferences(PREFERENCE_DEFAULTS, [1, 2, 3])).toEqual(
      PREFERENCE_DEFAULTS,
    );
  });

  it('merges a partial stored object over the defaults, field by field (the `{ "sound": false }` checklist case)', () => {
    const merged = mergeStoredPreferences(PREFERENCE_DEFAULTS, {
      sound: false,
    });
    expect(merged.sound).toBe(false);
    // Every other field keeps its default.
    expect(merged.pieceType).toBe("Shapes");
    expect(merged.preventInvalidMoves).toBe(true);
    expect(merged.hints).toEqual(PREFERENCE_DEFAULTS.hints);
    expect(merged.scalars).toEqual(PREFERENCE_DEFAULTS.scalars);
    expect(merged.scalars.dimension).toBe(3);
  });

  it("merges nested stored objects one level deep: a partial `hints` keeps its missing siblings", () => {
    const merged = mergeStoredPreferences(PREFERENCE_DEFAULTS, {
      hints: { fitPieceCount: false },
      pieceType: "Faces",
    });
    expect(merged.pieceType).toBe("Faces");
    expect(merged.hints.fitPieceCount).toBe(false);
    // The six sibling hints keep their defaults.
    expect(merged.hints.pieceCells).toBe(false);
    expect(merged.hints.fitOnDrag).toBe(true);
    expect(merged.hints.showFitPiecesOnHover).toBe(true);
    expect(merged.hints.availablePiecesCount).toBe(true);
    expect(merged.hints.availablePieceUniqueCell).toBe(true);
    expect(merged.hints.gameIsSolvable).toBe(true);
  });

  it("round-trips a full stored object (every field present and well-formed)", () => {
    const stored = {
      scalars: { base: 4, dimension: 3, size: 8 },
      pieceType: "Faces",
      hints: {
        fitPieceCount: false,
        pieceCells: true,
        fitOnDrag: false,
        showFitPiecesOnHover: false,
        availablePiecesCount: false,
        availablePieceUniqueCell: false,
        gameIsSolvable: false,
      },
      preventInvalidMoves: false,
      sound: false,
    } satisfies AppPreferences;
    const merged = mergeStoredPreferences(PREFERENCE_DEFAULTS, stored);
    expect(merged).toEqual(stored);
  });

  it("forces the merged `scalars.dimension` to 3 regardless of the stored value (§8.5 — the must-pass quirk)", () => {
    const storedBlobs: (JsonValue | undefined)[] = [
      { scalars: { dimension: 5 } },
      { scalars: { dimension: 0 } },
      { scalars: { dimension: "tall" } },
      { scalars: {} },
      {},
      undefined,
    ];
    for (const stored of storedBlobs) {
      expect(
        mergeStoredPreferences(PREFERENCE_DEFAULTS, stored).scalars.dimension,
      ).toBe(3);
    }
    // A well-formed stored scalars object still gets its dimension overridden.
    const merged = mergeStoredPreferences(PREFERENCE_DEFAULTS, {
      scalars: { base: 4, dimension: 9, size: 8 },
    });
    expect(merged.scalars).toEqual({ base: 4, dimension: 3, size: 8 });
  });

  it("falls back field-wise for malformed stored fields rather than letting them poison the result", () => {
    const merged = mergeStoredPreferences(PREFERENCE_DEFAULTS, {
      scalars: { base: "three", size: -2, dimension: 7 },
      pieceType: "Cats",
      hints: "not-an-object",
      preventInvalidMoves: "no",
      sound: null,
      stray: true, // unknown fields are dropped, not forwarded
    });
    expect(merged.scalars).toEqual({
      base: 3, // "three" is not a positive integer
      dimension: 3, // §8.5
      size: 6, // -2 is not a positive integer
    });
    expect(merged.pieceType).toBe("Shapes"); // "Cats" is not a PieceType
    expect(merged.hints).toEqual(PREFERENCE_DEFAULTS.hints);
    expect(merged.preventInvalidMoves).toBe(true); // "no" is not a boolean
    expect(merged.sound).toBe(true); // null is not a boolean
    expect("stray" in merged).toBe(false);
  });

  it("passes through any positive integer base/size — the merge is a shape guard, not a range guard", () => {
    // The merge's contract is type/shape validation only: any positive integer
    // passes through. The boot-time consequence of a very large value (e.g.
    // base: 2000 → new Array(2000 ** 3) ≈ 8e9) is handled by main.tsx's
    // try/catch around buildInitialAppState, which falls back to the §4.2
    // defaults when the board build fails, so the app always starts.
    const merged = mergeStoredPreferences(PREFERENCE_DEFAULTS, {
      scalars: { base: 2000, size: 6 },
    });
    expect(merged.scalars.base).toBe(2000);
    expect(merged.scalars.size).toBe(6);
  });

  it("keeps the defaults object untouched (no mutation of the merge base)", () => {
    const snapshot = JSON.stringify(PREFERENCE_DEFAULTS);
    mergeStoredPreferences(PREFERENCE_DEFAULTS, { sound: false });
    expect(JSON.stringify(PREFERENCE_DEFAULTS)).toBe(snapshot);
  });
});

/** A currently-filled board cell (the fit caches skip it, §3.5 step 1). */
function pickFilledCell(game: Game): Cell {
  for (let row = 0; row < game.size; row++) {
    for (let col = 0; col < game.size; col++) {
      if (game.board[row][col] !== null) return [row, col];
    }
  }
  throw new Error("fixture: unfolded game has no filled cell (impossible)");
}

/** A piece value the fixture's tray demonstrably does not hold. */
function pickStrayPiece(game: Game): Piece {
  for (const candidate of buildPiecePool(3, 3)) {
    if (!game.availablePieces.has(candidate)) return candidate;
  }
  throw new Error("fixture: tray holds the whole pool (impossible)");
}
