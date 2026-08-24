import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { KeyboardSensor, PointerSensor, TouchSensor } from "@dnd-kit/core";
import type { DndContextProps } from "@dnd-kit/core";
import { Telescope } from "telescopejs";
import { ThemeProvider } from "@mui/material/styles";
import { App } from "../App";
import type { AppState, AppPreferences } from "../App.types";
import { buildBoard } from "../game/boardBuilder";
import { unfoldGame } from "../game/gameBuilder";
import { darkTheme } from "../theme";

// §5.6/§7.6 sensor wiring: record the props the shell hands its `DndContext`, with the
// spy delegating to the real provider so the subtree (`useDraggable` / `useDroppable`
// / `useDndMonitor`) still registers exactly as in production. `vi.hoisted` puts the
// spy in scope of the hoisted mock factory.
const { dndContextSpy } = vi.hoisted(() => ({
  dndContextSpy: vi.fn<(props: DndContextProps) => void>(),
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      dndContextSpy(props);
      return <actual.DndContext {...props} />;
    },
  };
});

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals` mode is
// on; here it is off, so unmount explicitly (same convention as the Phase 5/7 tests).
afterEach(() => {
  cleanup();
});

// Each test mounts its own shell; drop any recorded `DndContext` calls between tests.
beforeEach(() => {
  dndContextSpy.mockClear();
});

const PREFERENCES = {
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
  preventInvalidMoves: true,
  sound: false,
} satisfies AppPreferences;

function buildAppState(): AppState {
  return {
    game: unfoldGame(buildBoard(4, 3, 3, 42), {
      preventInvalidMoves: PREFERENCES.preventInvalidMoves,
    }),
    preferences: PREFERENCES,
    invalidMoveSnackbarOpen: false,
    gameFinishedDialogOpen: false,
  };
}

/** The move engine's remaining unit count (distinct values may repeat). */
function remainingUnits(state: AppState): number {
  let total = 0;
  for (const count of state.game.availablePieces.values()) total += count;
  return total;
}

/** Mount the real shell the way `main.tsx` does (dark MUI theme forced, §5.1). */
function renderApp(state: AppState) {
  return render(
    <ThemeProvider theme={darkTheme}>
      <App state={state} telescope={Telescope.of(state)} />
    </ThemeProvider>,
  );
}

describe("App shell (§5.1 + §5.6 shared drag context)", () => {
  it("mounts the whole shell inside one shared DndContext, with no console-crippling errors", () => {
    const state = buildAppState();
    renderApp(state);

    // Mounting proves the load-bearing structural contract (§5.6, docs/CONVENTIONS.md
    // dnd-kit note): `useDndMonitor` (the shell's drag-end handler) THROWS if called
    // outside a DndContext descendant, and `useDraggable`/`useDroppable` register via
    // the same ancestor context. A shell where any of those ran in the <DndContext>
    // constructor's own body would fail here, not silently later with over === null.

    // Board: size² cells, split by the game state into filled placeholders
    // (role="img") and blank-cell drop-target rings (aria-hidden). The heading's own
    // div is wrapped by BoardDisplay's root box, which also owns the grid.
    const headingDiv = screen.getByText("Board (4×4)").closest("div");
    if (headingDiv === null)
      throw new Error("board heading missing its wrapping div");
    const boardRoot = headingDiv.parentElement;
    if (boardRoot === null) throw new Error("board root div has no parent");
    const filled = boardRoot.querySelectorAll('[role="img"]').length;
    const blank = boardRoot.querySelectorAll('[aria-hidden="true"]').length;
    expect(filled + blank).toBe(state.game.size * state.game.size);
    expect(blank).toBe(remainingUnits(state));

    // Tray: one dnd-kit draggable node per distinct remaining piece value — announced
    // as a focusable draggable (useDraggable's attributes) with its Phase 6 piece
    // image rendered inside.
    const trayValues = new Set(state.game.availablePieces.keys()).size;
    const draggables = screen
      .getAllByRole("button", {
        hidden: undefined,
      })
      .filter(
        (btn) => btn.getAttribute("aria-roledescription") === "draggable",
      );
    expect(draggables).toHaveLength(trayValues);
    for (const node of draggables) {
      expect(node.getAttribute("tabindex")).toBe("0");
      expect(node.querySelector("svg")).not.toBeNull();
    }

    // Top bar (§5.1): Undo is present and disabled with an empty move history.
    expect(
      screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("accepts desktop pointer AND mobile touch on the one shared DndContext (§5.6/§7.6)", () => {
    renderApp(buildAppState());

    const sensors = dndContextSpy.mock.calls.at(-1)?.[0]?.sensors;
    expect(sensors).toBeDefined();

    // §7.6: every input mode lands on the single shared context — no mobile-only
    // DndContext, no forked code path:
    const bySensor = new Map(
      (sensors ?? []).map((descriptor): [unknown, unknown] => [
        descriptor.sensor,
        descriptor.options,
      ]),
    );

    // §5.6 desktop pointer — exactly the unconstrained sensor the library defaults
    // to, Phase 8's regression floor for the mouse/pen path.
    expect(bySensor.get(PointerSensor)).toEqual({});
    // Phase 8's keyboard drag path survives the explicit sensor set.
    expect(bySensor.get(KeyboardSensor)).toEqual({});
    // §7.6 mobile touch — the delay/tolerance activation constraint: holding the
    // piece still activates the drag after the delay (the drag then keeps the page
    // from scrolling); moving past the tolerance within the delay hands the gesture
    // back to page scrolling instead.
    expect(bySensor.get(TouchSensor)).toEqual({
      activationConstraint: { delay: 250, tolerance: 5 },
    });
  });
});
