import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import type {
  Active,
  ClientRect,
  DragEndEvent,
  DragOverEvent,
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
import type { AppInternalState } from "../useAppState";

function buildState(preventInvalidMoves = true, fitOnDrag = false): AppState {
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
        fitOnDrag,
        showFitPiecesOnHover: false,
        availablePiecesCount: false,
        availablePieceUniqueCell: false,
        gameIsSolvable: false,
      },
      preventInvalidMoves,
      sound: false,
    },
    // Inert placeholder: the action tier under test never reads the clock.
    gamePlay: { startTime: 0 },
    invalidMoveSnackbarOpen: false,
    dragHint: "None",
  };
}

/**
 * A state-tier internal shape for exercising `useAppActions` in isolation: the
 * orchestrator (`useAppViewModel`) normally creates this via `useAppState`, but
 * the action tier only needs its fields by value, so a plain fixture stands in.
 */
function buildInternal(
  overrides: Partial<AppInternalState> = {},
): AppInternalState {
  return {
    trayEmpty: false,
    finishedElapsedMs: null,
    solvable: true,
    dialogDismissed: false,
    setDialogDismissed: vi.fn(),
    ...overrides,
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

/**
 * A (piece, blank cell) pair where the piece does NOT legally fit the cell — the
 * mirror image of `pickLegalPlacement`, read straight off the fit cache. The piece
 * must be one the tray still holds (otherwise the drop is rejected by tray lookup
 * long before the fit check).
 */
function pickIllegalPlacement(
  game: Game,
): readonly [readonly number[], readonly [number, number]] {
  for (const [piece, count] of game.availablePieces) {
    if (count === 0) continue;
    for (const idx of game.cellToFitPieces.keys()) {
      const fits = game.cellToFitPieces.get(idx) ?? [];
      if (!fits.includes(piece)) {
        return [piece, [Math.floor(idx / game.size), idx % game.size]];
      }
    }
  }
  throw new Error("fixture: no illegal placement (impossible)");
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
 * A fully-shaped drag-event fixture: the monitor reads only `active.id` and
 * `over.id`, so every other field is an inert placeholder that still has to
 * satisfy `Active`/`Over` by construction. `DragEndEvent` and `DragOverEvent`
 * share the exact same field shape (both extend `DragEvent`), so one fixture
 * serves both the drag-end and the drag-over paths.
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

function dragEventFixture(
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier | null,
): DragEndEvent & DragOverEvent {
  return {
    activatorEvent: new Event("pointerdown"),
    active: fixtureActive(activeId),
    collisions: null,
    delta: { x: 0, y: 0 },
    over: overId === null ? null : fixtureOver(overId),
  };
}

function dragEndEvent(
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier | null,
): DragEndEvent {
  return dragEventFixture(activeId, overId);
}

function dragOverEvent(
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier | null,
): DragOverEvent {
  return dragEventFixture(activeId, overId);
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
function dragEndHarness(
  preventInvalidMoves = true,
  fitOnDrag = false,
  internal: AppInternalState = buildInternal(),
) {
  const state = buildState(preventInvalidMoves, fitOnDrag);
  const [piece, placement] = pickLegalPlacement(state.game);
  const telescope = Telescope.of(state);
  const emissions: AppState[] = [];

  const { result, rerender } = renderHook(
    (s: AppState) => useAppActions({ state: s, telescope }, internal),
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

/* -------------------------------------------------------------------------- */
/* §5.6 / Phase 14 — the drag-fit hint lifecycle on the dedicated telescope  */
/* -------------------------------------------------------------------------- */

describe("useAppActions (§5.6 / Phase 14 drag-fit hint lifecycle)", () => {
  it("onDragStart writes `Unknown` through the dedicated telescope: one emission, game untouched", () => {
    const { state, actions, emissions, unsubscribe } = dragEndHarness(
      true,
      true,
    );

    actions.onDragStart();
    unsubscribe();

    const next = emissions.at(-1);
    if (next === undefined)
      throw new Error("fixture: the start emission is missing (impossible)");
    expect(next.dragHint).toBe("Unknown");
    // The hint commit lands on the slice only — the move engine state is untouched.
    expect(next.game).toBe(state.game);
  });

  it("onDragOver with no hovered target rewrites nothing new: `Unknown` stays, no re-emission", () => {
    const { piece, actions, emissions, unsubscribe } = dragEndHarness(
      true,
      true,
    );

    actions.onDragStart(); // → Unknown (one emission)
    // dnd-kit fires onDragOver when the hovered target changes; hovering nothing
    // reports over === null. The computed hint equals the live one, so the lens
    // setter no-ops and the distinctUntilChanged'd stream re-emits nothing.
    actions.onDragOver(dragOverEvent(trayPieceDraggableId(piece), null));
    unsubscribe();

    expect(emissions).toHaveLength(2);
    expect(emissions.at(-1)?.dragHint).toBe("Unknown");
  });

  it("onDragOver over a legal target writes `Ok`; over an illegal one writes `NotOk`", () => {
    const harness = dragEndHarness(true, true);
    const { piece, placement, actions, emissions, unsubscribe } = harness;
    const [row, col] = placement;
    const [badPiece, badCell] = pickIllegalPlacement(harness.state.game);

    actions.onDragStart();
    actions.onDragOver(
      dragOverEvent(trayPieceDraggableId(piece), cellDroppableId(row, col)),
    );
    actions.onDragOver(
      dragOverEvent(
        trayPieceDraggableId(badPiece),
        cellDroppableId(badCell[0], badCell[1]),
      ),
    );
    unsubscribe();

    // Replayed initial + Unknown + Ok + NotOk — each value change is one emission.
    expect(emissions).toHaveLength(4);
    expect(emissions[1].dragHint).toBe("Unknown");
    expect(emissions[2].dragHint).toBe("Ok");
    expect(emissions[3].dragHint).toBe("NotOk");
    // The hint is a read of the fit cache — no move was ever committed.
    expect(emissions[3].game).toBe(harness.state.game);
  });

  it("onDragOver never produces Ok/NotOk while `hintFitOnDrag` is off — the hint stays `Unknown`", () => {
    const harness = dragEndHarness(true, false);
    const { piece, placement, actions, emissions, unsubscribe } = harness;
    const [row, col] = placement;
    const [badPiece, badCell] = pickIllegalPlacement(harness.state.game);

    actions.onDragStart();
    actions.onDragOver(
      dragOverEvent(trayPieceDraggableId(piece), cellDroppableId(row, col)),
    );
    actions.onDragOver(
      dragOverEvent(
        trayPieceDraggableId(badPiece),
        cellDroppableId(badCell[0], badCell[1]),
      ),
    );
    unsubscribe();

    // Only start emitted: both over-targets compute `Unknown`, the value the slice
    // already holds, so neither commit re-emits.
    expect(emissions).toHaveLength(2);
    expect(emissions.at(-1)?.dragHint).toBe("Unknown");
    expect(emissions.at(-1)?.game).toBe(harness.state.game);
  });

  it("onDragCancel returns the hint to `None` without placing anything", () => {
    const harness = dragEndHarness(true, true);
    const { piece, placement, actions, emissions, unsubscribe } = harness;
    const [row, col] = placement;

    actions.onDragStart();
    actions.onDragOver(
      dragOverEvent(trayPieceDraggableId(piece), cellDroppableId(row, col)),
    );
    actions.onDragCancel();
    unsubscribe();

    expect(emissions).toHaveLength(4);
    expect(emissions.at(-1)?.dragHint).toBe("None");
    // A cancelled drag places nothing: the engine state is the very same object.
    expect(emissions.at(-1)?.game).toBe(harness.state.game);
  });

  it("onGameFinishedDialogClose (§5.13 / Phase 15) commits the dismissal through the state tier's setter — and nothing else", () => {
    const internal = buildInternal();
    const { state, actions, emissions, unsubscribe } = dragEndHarness(
      true,
      false,
      internal,
    );

    actions.onGameFinishedDialogClose();
    unsubscribe();

    // The dismissal is the shell's local UI state (§7.2.1 "dialog open/closed"),
    // not `AppState`: the action flips the state tier's flag, and the shell
    // telescope re-emits nothing (only the replayed initial state is observed).
    expect(internal.setDialogDismissed).toHaveBeenCalledTimes(1);
    expect(internal.setDialogDismissed).toHaveBeenCalledWith(true);
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toBe(state);
  });

  it("onDragEnd resets the hint to `None` after its placement commit, production-faithfully (re-rendered between commits)", () => {
    const harness = dragEndHarness(true, true);
    const { piece, placement, emissions, rerender, unsubscribe } = harness;
    const [row, col] = placement;

    // In production the shell re-renders on every emission, so each action commits
    // against the tree's CURRENT state — mirror that between commits: re-render on the
    // emission, then drive the hook's FRESH closures (the live `harness.actions`, not
    // a first-render capture) with the next event.
    harness.actions.onDragStart();
    const s1 = emissions.at(-1);
    if (s1 === undefined)
      throw new Error("fixture: the start emission is missing (impossible)");
    rerender(s1);
    harness.actions.onDragOver(
      dragOverEvent(trayPieceDraggableId(piece), cellDroppableId(row, col)),
    );
    const s2 = emissions.at(-1);
    if (s2 === undefined)
      throw new Error("fixture: the over emission is missing (impossible)");
    rerender(s2);
    harness.actions.onDragEnd(
      dragEndEvent(trayPieceDraggableId(piece), cellDroppableId(row, col)),
    );
    unsubscribe();

    // start + over + the drag-end's two commits: the placement first (the hint still
    // shows the in-drag value on that emission), then the dedicated telescope's
    // `None` reset composed onto the placement's next state.
    expect(emissions).toHaveLength(5);
    expect(emissions[3].game.placedCells).toHaveLength(1);
    expect(emissions[3].dragHint).toBe("Ok");
    expect(emissions[4].game).toBe(emissions[3].game);
    expect(emissions[4].dragHint).toBe("None");
  });
});
