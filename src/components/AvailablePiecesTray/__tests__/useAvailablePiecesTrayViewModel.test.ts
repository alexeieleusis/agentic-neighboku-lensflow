import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { firstValueFrom } from "rxjs";
import { Telescope } from "telescopejs";
import { createPiece, type Piece } from "../../../game/entities";
import { buildBoard } from "../../../game/boardBuilder";
import {
  cellFromIndex,
  cellIndex,
  unfoldGame,
  type Game,
  type Move,
  type PieceFitCache,
  type Tray,
} from "../../../game/gameBuilder";
import type { Board } from "../../../game/boardBuilder";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import { TRAY_PIECE_IMAGE_PX } from "../useAvailablePiecesTrayDomain";
import { useAvailablePiecesTrayViewModel } from "../useAvailablePiecesTrayViewModel";
import type {
  AvailablePiecesTrayColumn,
  AvailablePiecesTrayState,
} from "../AvailablePiecesTray.types";

function trayOf(
  entries: ReadonlyArray<readonly [readonly number[], number]>,
): Tray {
  const tray = new Map<Piece, number>();
  for (const [digits, count] of entries) {
    tray.set(createPiece(digits, 3, 3), count);
  }
  return tray;
}

/**
 * A stand-in `Game` for the read-only derivations (the view-model test never
 * commits, so `placePiece` never indexes the board — an empty stand-in board
 * suffices; the commit test below uses a real, freshly-unfolded game).
 */
const EMPTY_BOARD: Board = [];
const NO_MOVES: readonly Move[] = [];

function readGame(
  size: number,
  tray: Tray,
  pieceToFitCells: PieceFitCache = new Map<Piece, number[]>(),
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
  pieceType: "Shapes" | "Faces" = "Shapes",
): AvailablePiecesTrayState {
  return { game, availablePieceUniqueCell, pieceCells, pieceType };
}

/** Render `useAvailablePiecesTrayViewModel` against a standalone tray telescope. */
function renderViewModel(state: AvailablePiecesTrayState) {
  const props: TelescopedProps<AvailablePiecesTrayState> = {
    state,
    telescope: Telescope.of(state),
  };
  return renderHook(() => useAvailablePiecesTrayViewModel(props));
}

describe("useAvailablePiecesTrayViewModel (Phase 13 orchestrator)", () => {
  it("derives one sorted column per remaining value", () => {
    const { result } = renderViewModel(
      trayState(
        readGame(
          6,
          trayOf([
            [[1, 1, 1], 2],
            [[0, 2, 0], 1],
            [[0, 0, 0], 3],
            [[1, 0, 0], 0],
          ]),
        ),
      ),
    );

    // The zero-count value ([1,0,0]) gets no column; the rest sort ascending by
    // base-10 value: [0,0,0]→0, [0,2,0]→20, [1,1,1]→111.
    expect(result.current.columns.map((c) => [...c.piece])).toEqual([
      [0, 0, 0],
      [0, 2, 0],
      [1, 1, 1],
    ]);
    expect(result.current.columns.map((c) => c.count)).toEqual([3, 1, 2]);
    // Both hints off by default in this fixture: no column is forced and no
    // column lists a placement.
    expect(
      result.current.columns.every((c) => c.forcedPlacement === false),
    ).toBe(true);
    expect(result.current.columns.every((c) => c.placements.length === 0)).toBe(
      true,
    );
  });

  it("gates the per-column `*` and button list on the hint flags (delegated to the domain tier)", () => {
    // [0,2,0] ×1 remaining with exactly one legal fit-cell → forced; [1,0,0] ×1
    // remaining with two fit-cells → not.
    const pieceA = createPiece([0, 2, 0], 3, 3);
    const pieceB = createPiece([1, 0, 0], 3, 3);
    const game = readGame(
      6,
      new Map<Piece, number>([
        [pieceA, 1],
        [pieceB, 1],
      ]),
      new Map<Piece, number[]>([
        [pieceA, [0]],
        [pieceB, [3, 4]],
      ]),
    );
    const byPiece = (
      columns: readonly AvailablePiecesTrayColumn[],
    ): ReadonlyMap<Piece, AvailablePiecesTrayColumn> =>
      new Map(columns.map((c) => [c.piece, c]));

    const off = byPiece(
      renderViewModel(trayState(game)).result.current.columns,
    );
    expect(off.get(pieceA)?.forcedPlacement).toBe(false);
    expect(off.get(pieceA)?.placements).toHaveLength(0);

    const uniqueCellOn = byPiece(
      renderViewModel(trayState(game, true)).result.current.columns,
    );
    expect(uniqueCellOn.get(pieceA)?.forcedPlacement).toBe(true);
    expect(uniqueCellOn.get(pieceB)?.forcedPlacement).toBe(false);
    // still no button list (pieceCells is off)
    expect(uniqueCellOn.get(pieceA)?.placements).toHaveLength(0);

    const pieceCellsOn = byPiece(
      renderViewModel(trayState(game, false, true)).result.current.columns,
    );
    expect(pieceCellsOn.get(pieceA)?.placements).toEqual([
      { cell: [0, 0], label: "1,1" },
    ]);
    expect(pieceCellsOn.get(pieceB)?.placements).toEqual([
      { cell: [0, 3], label: "1,4" },
      { cell: [0, 4], label: "1,5" },
    ]);

    const bothOn = byPiece(
      renderViewModel(trayState(game, true, true)).result.current.columns,
    );
    expect(bothOn.get(pieceA)?.forcedPlacement).toBe(true);
    expect(bothOn.get(pieceA)?.placements).toHaveLength(1);
  });

  it("hands each column its piece image as a live magnified-telescope slice", async () => {
    // Build the tray with a single shared piece reference (§8.7: map lookups are by
    // reference), so the column's piece is that exact instance.
    const piece = createPiece([1, 0, 0], 3, 3);
    const tray = new Map<Piece, number>([[piece, 1]]);
    const { result } = renderViewModel(trayState(readGame(4, tray)));
    const column: AvailablePiecesTrayColumn = result.current.columns[0];

    expect(column.piece).toBe(piece);
    expect(column.count).toBe(1);
    expect(column.pieceImage.state).toEqual({
      piece,
      size: TRAY_PIECE_IMAGE_PX,
      pieceType: "Shapes",
    });

    // The magnified telescope is a working slice: its stream emits the column's
    // piece-image state.
    await expect(
      firstValueFrom(column.pieceImage.telescope.stream),
    ).resolves.toEqual({
      piece,
      size: TRAY_PIECE_IMAGE_PX,
      pieceType: "Shapes",
    });
  });

  it("forwards the slice's §5.4 pieceType into each column's piece-image slice", () => {
    const piece = createPiece([0, 2, 1], 3, 3);
    const tray = new Map<Piece, number>([[piece, 1]]);
    const { result } = renderViewModel(
      trayState(readGame(4, tray), false, false, "Faces"),
    );
    const column = result.current.columns[0];

    expect(column.pieceImage.state).toEqual({
      piece,
      size: TRAY_PIECE_IMAGE_PX,
      pieceType: "Faces",
    });
  });

  it("tracks the tray state as the underlying game state changes", () => {
    const telescope = Telescope.of(
      trayState(
        readGame(
          6,
          trayOf([
            [[0, 0, 0], 2],
            [[1, 1, 1], 1],
          ]),
        ),
      ),
    );

    const stateA = trayState(
      readGame(
        6,
        trayOf([
          [[0, 0, 0], 2],
          [[1, 1, 1], 1],
        ]),
      ),
    );

    const { result, rerender } = renderHook(
      (state: AvailablePiecesTrayState) =>
        useAvailablePiecesTrayViewModel({ state, telescope }),
      { initialProps: stateA },
    );

    expect(result.current.columns.map((c) => c.count)).toEqual([2, 1]);

    // Place both copies of the smaller value: it must drop its column entirely…
    rerender(
      trayState(
        readGame(
          6,
          trayOf([
            [[0, 0, 0], 0],
            [[1, 1, 1], 1],
          ]),
        ),
      ),
    );
    expect(result.current.columns.map((c) => [...c.piece])).toEqual([
      [1, 1, 1],
    ]);

    // …and undoing it must bring the column back in its sorted slot.
    rerender(
      trayState(
        readGame(
          6,
          trayOf([
            [[0, 0, 0], 1],
            [[1, 1, 1], 1],
          ]),
        ),
      ),
    );
    expect(result.current.columns.map((c) => [...c.piece])).toEqual([
      [0, 0, 0],
      [1, 1, 1],
    ]);
    expect(result.current.columns.map((c) => c.count)).toEqual([1, 1]);
  });

  it("returns no columns when the tray is empty or all counts are zero", () => {
    const empty = renderViewModel(
      trayState(readGame(6, new Map<Piece, number>())),
    );
    expect(empty.result.current.columns).toEqual([]);

    const allZero = renderViewModel(
      trayState(readGame(6, trayOf([[[0, 0, 0], 0]]))),
    );
    expect(allZero.result.current.columns).toEqual([]);
  });

  it("commits a click-to-place through the tray telescope: board filled, tray decremented, columns recomputed", () => {
    // A real, freshly-unfolded game: the commit goes through placePiece, which
    // indexes the board and recomputes both caches.
    const game = unfoldGame(buildBoard(4, 3, 3, 42), {
      preventInvalidMoves: true,
    });
    const state = trayState(game, true, true);
    const [piece, [row, col]] = pickLegalPlacement(game);
    const targetIdx = cellIndex(game.size, row, col);
    const countBefore = game.availablePieces.get(piece);
    if (countBefore === undefined)
      throw new Error("fixture: legal piece missing from tray (impossible)");

    const telescope = Telescope.of(state);
    const emissions: AvailablePiecesTrayState[] = [];
    const { result, rerender } = renderHook(
      (s: AvailablePiecesTrayState) =>
        useAvailablePiecesTrayViewModel({ state: s, telescope }),
      { initialProps: state },
    );
    const subscription = telescope.stream.subscribe((s) => emissions.push(s));

    act(() => {
      result.current.onPlacePiece(piece, [row, col]);
    });

    // Replayed initial state + exactly one committed update.
    expect(emissions).toHaveLength(2);
    const next = emissions[1];
    expect(next).not.toBe(state);
    expect(next.game.board[row][col]).toBe(piece);
    if (countBefore > 1)
      expect(next.game.availablePieces.get(piece)).toBe(countBefore - 1);
    else expect(next.game.availablePieces.get(piece)).toBeUndefined();
    expect(next.game.placedCells.at(-1)?.cell).toEqual([row, col]);
    for (const cells of next.game.pieceToFitCells.values()) {
      expect(cells).not.toContain(targetIdx);
    }

    // The root re-renders on the emission: the recomputed columns no longer offer
    // the just-filled cell, and the moved value's count has dropped (or its column
    // is gone outright).
    const columnBefore = result.current.columns.find((c) => c.piece === piece);
    if (columnBefore !== undefined) {
      expect(
        columnBefore.placements.some(
          (p) => p.cell[0] === row && p.cell[1] === col,
        ),
      ).toBe(true);
    }
    rerender(next);
    const columnAfter = result.current.columns.find((c) => c.piece === piece);
    if (countBefore > 1) {
      expect(columnAfter?.count).toBe(countBefore - 1);
      expect(
        (columnAfter?.placements ?? []).some(
          (p) => p.cell[0] === row && p.cell[1] === col,
        ),
      ).toBe(false);
    } else {
      expect(columnAfter).toBeUndefined();
    }
    subscription.unsubscribe();
  });
});

/** A guaranteed-legal (piece, blank cell) pair, read off the fit cache. */
function pickLegalPlacement(
  game: Game,
): readonly [Piece, readonly [number, number]] {
  for (const [piece, cells] of game.pieceToFitCells) {
    if (cells.length > 0) {
      return [piece, cellFromIndex(game.size, cells[0])];
    }
  }
  throw new Error("fixture: unfolded game has no legal placement (impossible)");
}
