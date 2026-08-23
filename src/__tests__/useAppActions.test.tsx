import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import type { DragEndEvent, Active, Over } from "@dnd-kit/core";
import { Telescope } from "telescopejs";
import type { AppState } from "../App.types";
import { cellDroppableId } from "../components/CellDisplay/useCellDisplayDomain";
import { trayPieceDraggableId } from "../components/DraggablePiece/useDraggablePieceDomain";
import { buildBoard } from "../game/boardBuilder";
import { unfoldGame, type Game } from "../game/gameBuilder";
import { useAppActions } from "../useAppActions";

function buildState(preventInvalidMoves = true): AppState {
  const game: Game = unfoldGame(buildBoard(4, 3, 3, 42), {
    preventInvalidMoves,
  });
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
      preventInvalidMoves,
      sound: false,
    },
    invalidMoveSnackbarOpen: false,
    gameFinishedDialogOpen: false,
  };
}

function pickLegalPlacement(
  game: Game,
): readonly [readonly number[], readonly [number, number]] {
  for (const [piece, cells] of game.pieceToFitCells) {
    if (cells.length > 0) {
      const [row, col] = [
        Math.floor(cells[0] / game.size),
        cells[0] % game.size,
      ];
      return [piece, [row, col]];
    }
  }
  throw new Error("fixture: no legal placement (impossible)");
}

/** A structurally-valid DragEndEvent carrying only the ids the monitor reads. */
function dragEndEvent(activeId: string, overId: string | null): DragEndEvent {
  return {
    activatorEvent: new Event("pointerdown"),
    active: { id: activeId } as unknown as Active,
    collisions: null,
    delta: { x: 0, y: 0 },
    over: overId === null ? null : ({ id: overId } as unknown as Over),
  };
}

/** `useAppActions`'s `useDndMonitor` throws outside a DndContext — test it inside one. */
function dndWrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

describe("useAppActions (§5.6 handleDragEnd → placePiece)", () => {
  it("commits a legal drop through the shell telescope: board filled, tray decremented", () => {
    const state = buildState();
    const [piece, [row, col]] = pickLegalPlacement(state.game);
    const telescope = Telescope.of(state);
    const emissions: AppState[] = [];

    const { result } = renderHook(
      (s: AppState) => useAppActions({ state: s, telescope }),
      { wrapper: dndWrapper, initialProps: state },
    );
    const subscription = telescope.stream.subscribe((s) => emissions.push(s));

    result.current.onDragEnd(
      dragEndEvent(trayPieceDraggableId(piece), cellDroppableId(row, col)),
    );
    subscription.unsubscribe();

    // The replayed initial state + exactly one committed update.
    expect(emissions).toHaveLength(2);
    const next = emissions[1];
    expect(next).not.toBe(state);
    expect(next.game).not.toBe(state.game);
    expect([...(next.game.board[row][col] ?? [])].join(",")).toBe(
      [...piece].join(","),
    );
    expect(next.game.placedCells).toHaveLength(1);
    expect(next.game.placedCells[0].isValid).toBe(true);
  });

  it("is a no-op for a drop outside any droppable (no re-emission)", () => {
    const state = buildState();
    const [piece] = pickLegalPlacement(state.game);
    const telescope = Telescope.of(state);
    const emissions: AppState[] = [];

    const { result } = renderHook(
      (s: AppState) => useAppActions({ state: s, telescope }),
      { wrapper: dndWrapper, initialProps: state },
    );
    const subscription = telescope.stream.subscribe((s) => emissions.push(s));

    result.current.onDragEnd(dragEndEvent(trayPieceDraggableId(piece), null));
    subscription.unsubscribe();

    // Only the replayed initial state — the distinctUntilChanged'd stream saw no
    // change because resolveDragDrop returned the input state itself.
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toBe(state);
  });

  it("absorbs an invalid drop (preventInvalidMoves): no crash, state unchanged", () => {
    const state = buildState();
    const [piece, [row, col]] = pickLegalPlacement(state.game);
    const telescope = Telescope.of(state);
    const emissions: AppState[] = [];

    const { result } = renderHook(
      (s: AppState) => useAppActions({ state: s, telescope }),
      { wrapper: dndWrapper, initialProps: state },
    );
    const subscription = telescope.stream.subscribe((s) => emissions.push(s));

    // Out-of-bounds target for this 4×4 board: placePiece throws, the monitor absorbs.
    expect(() =>
      result.current.onDragEnd(
        dragEndEvent(trayPieceDraggableId(piece), cellDroppableId(9, 9)),
      ),
    ).not.toThrow();
    subscription.unsubscribe();

    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toBe(state);
    expect(state.game.board[row][col]).toBeNull();
  });
});
