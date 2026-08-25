import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { KeyboardSensor, PointerSensor, TouchSensor } from "@dnd-kit/core";
import type { DndContextProps } from "@dnd-kit/core";
import { Telescope } from "telescopejs";
import type { TelescopedProps } from "../base/TelescopeComponent";
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

/**
 * Mount the real shell the way `main.tsx` does (dark MUI theme forced, §5.1), with
 * the root's once-per-stream subscription (§5.1) reproduced: `App` receives only the
 * latest state snapshot and never subscribes to the stream itself, so a test that
 * writes through the telescope (an action commit, a Snackbar dismissal) sees the
 * shell re-render only through this same subscription path.
 */
function renderApp(state: AppState) {
  const telescope = Telescope.of(state);
  const utils = render(
    <ThemeProvider theme={darkTheme}>
      <ShellHarness state={state} telescope={telescope} />
    </ThemeProvider>,
  );
  return { ...utils, telescope };
}

/** The `main.tsx` root subscription, factored into a component for the test harness. */
function ShellHarness(props: TelescopedProps<AppState>): React.ReactElement {
  const [current, setCurrent] = useState(props.state);
  useEffect(() => {
    const subscription = props.telescope.stream.subscribe(setCurrent);
    return () => subscription.unsubscribe();
  }, [props.telescope]);
  return <App state={current} telescope={props.telescope} />;
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

    // Overlays start closed (§5.12 Phase 11 / §5.13 Phase 15): a closed MUI
    // Snackbar renders nothing at all, so the feedback simply is not in the DOM.
    expect(screen.queryByText("Invalid move!")).toBeNull();
    expect(screen.queryByText("Game finished")).toBeNull();
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

/* -------------------------------------------------------------------------- */
/* §5.12 invalid-move feedback (Phase 11)                                     */
/* -------------------------------------------------------------------------- */

/**
 * The shell with the invalid-move feedback flagged OPEN in its initial state — the
 * same `AppState` shape a rejected placement produces through
 * `resolveDragDrop` → `useAppActions.onDragEnd`; the open/closed round-trip below is
 * what the real drag path is composed of (domain+action coverage lives in
 * `useAppDomain.test.ts` / `useAppActions.test.tsx`).
 */
function buildOpenSnackbarState(): AppState {
  return { ...buildAppState(), invalidMoveSnackbarOpen: true };
}

describe("App shell §5.12 — invalid-move feedback (Phase 11)", () => {
  it("renders the error-severity 'Invalid move!' alert while the flag is set, and the close button dismisses it through the shell's action tier", () => {
    vi.useFakeTimers();
    try {
      const { telescope } = renderApp(buildOpenSnackbarState());
      const emissions: AppState[] = [];
      const subscription = telescope.stream.subscribe((s) => emissions.push(s));

      // §5.12: an error-severity Alert with the exact text. A `severity="error"`
      // Alert roots at role="alert" (only success maps to "status") and carries
      // the error color class.
      const alert = screen.getByRole("alert");
      expect(alert.className).toContain("MuiAlert-colorError");
      expect(alert.contains(screen.getByText("Invalid move!"))).toBe(true);

      // §5.12 manual close: the Alert's own close button (MUI wires its onClick to
      // the Alert's `onClose`, which the shell hands to its action tier — the two
      // are distinct callbacks, both committed through the telescope).
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      act(() => {
        vi.advanceTimersByTime(1000); // let the exit transition settle
      });

      // The dismissal flowed through the action tier, not local UI state: the
      // shell telescope re-emitted with the flag closed, and the alert left the DOM.
      expect(emissions.at(-1)?.invalidMoveSnackbarOpen).toBe(false);
      expect(screen.queryByText("Invalid move!")).toBeNull();
      subscription.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });

  it("auto-hides the open feedback after 6 seconds, with no interaction", () => {
    vi.useFakeTimers();
    try {
      const { telescope } = renderApp(buildOpenSnackbarState());
      const emissions: AppState[] = [];
      const subscription = telescope.stream.subscribe((s) => emissions.push(s));

      expect(screen.getByText("Invalid move!")).toBeTruthy();

      // §5.12 autoHideDuration: the 6-second timer is MUI's own; on expiry it fires
      // the Snackbar's `onClose`, which is the shell's close action — so the state
      // flip below is the auto-hide, not any local timer outside the telescope.
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      // The open→false re-render flushes at that act's end, which is when MUI starts
      // the exit transition (its own timer, scheduled after the 6-second mark) — so
      // it only settles on a further advance.
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(emissions.at(-1)?.invalidMoveSnackbarOpen).toBe(false);
      expect(screen.queryByText("Invalid move!")).toBeNull();
      subscription.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });
});
