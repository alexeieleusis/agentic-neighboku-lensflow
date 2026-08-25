import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import type {
  Active,
  ClientRect,
  DragEndEvent,
  Over,
  UniqueIdentifier,
} from "@dnd-kit/core";
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

const ZERO_RECT = {
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const satisfies ClientRect;

/**
 * A fully-shaped DragEndEvent fixture: the monitor reads only `active.id` and
 * `over.id`, so every other field is an inert placeholder that still has to
 * satisfy `Active`/`Over` by construction.
 */
function fixtureActive(id: UniqueIdentifier): Active {
  return {
    id,
    data: { current: {} },
    rect: { current: { initial: null, translated: null } },
  };
}

function fixtureOver(id: UniqueIdentifier): Over {
  return { id, rect: ZERO_RECT, disabled: false, data: { current: {} } };
}

function dragEndEvent(
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier | null,
): DragEndEvent {
  return {
    activatorEvent: new Event("pointerdown"),
    active: fixtureActive(activeId),
    collisions: null,
    delta: { x: 0, y: 0 },
    over: overId === null ? null : fixtureOver(overId),
  };
}

/** `useAppActions`'s `useDndMonitor` throws outside a DndContext — test it inside one. */
function dndWrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

/**
 * Shared drag-end harness: fixture state with a legal placement, the hook rendered
 * inside a DndContext, and every stream emission captured for later assertions.
 * `rerender` mirrors `main.tsx`'s root: after a commit, the shell tree re-renders on
 * the emission and the hook re-runs with the new state (fresh action closures) —
 * call it between commits that build on a previous one.
 */
function dragEndHarness(preventInvalidMoves = true) {
  const state = buildState(preventInvalidMoves);
  const [piece, placement] = pickLegalPlacement(state.game);
  const telescope = Telescope.of(state);
  const emissions: AppState[] = [];

  const { result, rerender } = renderHook(
    (s: AppState) => useAppActions({ state: s, telescope }),
    { wrapper: dndWrapper, initialProps: state },
  );
  const subscription = telescope.stream.subscribe((s) => emissions.push(s));

  return {
    state,
    piece,
    placement,
    get actions() {
      return result.current;
    },
    emissions,
    rerender,
    unsubscribe: () => subscription.unsubscribe(),
  };
}

describe("useAppActions (§5.6 handleDragEnd → placePiece)", () => {
  it("commits a legal drop through the shell telescope: board filled, tray decremented", () => {
    const { state, piece, placement, actions, emissions, unsubscribe } =
      dragEndHarness();
    const [row, col] = placement;

    actions.onDragEnd(
      dragEndEvent(trayPieceDraggableId(piece), cellDroppableId(row, col)),
    );
    unsubscribe();

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
    // A legal placement never opens the invalid-move feedback (§5.12).
    expect(next.invalidMoveSnackbarOpen).toBe(false);
  });

  it("is a no-op for a drop outside any droppable (no re-emission)", () => {
    const { state, piece, actions, emissions, unsubscribe } = dragEndHarness();

    actions.onDragEnd(dragEndEvent(trayPieceDraggableId(piece), null));
    unsubscribe();

    // Only the replayed initial state — the distinctUntilChanged'd stream saw no
    // change because resolveDragDrop returned the input state itself.
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toBe(state);
  });

  it("absorbs the move engine's throw on an illegal drop: opens the feedback, game untouched, no crash", () => {
    const { state, piece, actions, emissions, unsubscribe } = dragEndHarness();

    // Out-of-bounds target for this 4×4 board: placePiece throws at its domain
    // boundary (§3.5 precondition), the monitor absorbs, and the shell opens the
    // invalid-move feedback (§5.12) without committing any move.
    expect(() =>
      actions.onDragEnd(
        dragEndEvent(trayPieceDraggableId(piece), cellDroppableId(9, 9)),
      ),
    ).not.toThrow();
    unsubscribe();

    // Replayed initial state + the one rejection-emitting update.
    expect(emissions).toHaveLength(2);
    const next = emissions[1];
    expect(next).not.toBe(state);
    expect(next.invalidMoveSnackbarOpen).toBe(true);
    expect(next.game).toBe(state.game);
  });

  it("dismisses the invalid-move feedback through the shell telescope (§5.12)", () => {
    const harness = dragEndHarness();
    const { state, emissions, unsubscribe } = harness;

    // Open it the only way the shell opens it: a rejected placement.
    harness.actions.onDragEnd(
      dragEndEvent(trayPieceDraggableId(harness.piece), cellDroppableId(9, 9)),
    );
    // The `main.tsx` root re-renders on the emission: the hook re-runs against the
    // open state, so the dismissal closure below sees it (as in production, where an
    // action always commits against the tree's current state).
    const opened = harness.emissions.at(-1);
    if (opened === undefined)
      throw new Error(
        "fixture: the rejection emission is missing (impossible)",
      );
    harness.rerender(opened);
    // Dismiss it the way MUI's Snackbar/Alert fire the shell's action (auto-hide,
    // click-away, Escape, or the close button — all one code path).
    harness.actions.onInvalidMoveSnackbarClose();
    unsubscribe();

    expect(emissions).toHaveLength(3);
    expect(emissions[2].invalidMoveSnackbarOpen).toBe(false);
    expect(emissions[2].game).toBe(state.game);

    // A doubled dismissal is a no-op (same reference back): the distinctUntilChanged
    // stream re-emits nothing, so the count stays put.
    harness.actions.onInvalidMoveSnackbarClose();
    expect(emissions).toHaveLength(3);
  });
});
