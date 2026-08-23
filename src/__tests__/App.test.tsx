import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Telescope } from "telescopejs";
import { ThemeProvider } from "@mui/material/styles";
import { App } from "../App";
import type { AppState, AppPreferences } from "../App.types";
import { buildBoard } from "../game/boardBuilder";
import { unfoldGame } from "../game/gameBuilder";
import { darkTheme } from "../theme";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals` mode is
// on; here it is off, so unmount explicitly (same convention as the Phase 5/7 tests).
afterEach(() => {
  cleanup();
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
    const boardRoot = screen
      .getByText("Board (4×4)")
      .closest("div")!.parentElement;
    expect(boardRoot).not.toBeNull();
    const filled = boardRoot!.querySelectorAll('[role="img"]').length;
    const blank = boardRoot!.querySelectorAll('[aria-hidden="true"]').length;
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
});
