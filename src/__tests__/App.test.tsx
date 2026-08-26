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
import { unfoldGame, type Game } from "../game/gameBuilder";
import { buildUnsolvableFinishedGame, playToCompletion } from "./fixtures";
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

function buildFreshGame(): Game {
  return unfoldGame(buildBoard(4, 3, 3, 42), {
    preventInvalidMoves: PREFERENCES.preventInvalidMoves,
  });
}

function buildAppState(game: Game = buildFreshGame()): AppState {
  return {
    game,
    preferences: PREFERENCES,
    gamePlay: { startTime: Date.now() },
    invalidMoveSnackbarOpen: false,
    dragHint: "None",
  };
}

/** The shell state with the §4.2 `hintGameIsSolvable` preference flipped on. */
function buildAppStateWithHintOn(game: Game = buildFreshGame()): AppState {
  const state = buildAppState(game);
  return {
    ...state,
    preferences: {
      ...state.preferences,
      hints: { ...state.preferences.hints, gameIsSolvable: true },
    },
  };
}

/**
 * A finished-solvable shell state with the game clock back-dated 2h 2m 15s, so
 * the success alert's elapsed string is the deterministic `2h 2m 15s` (the
 * `Date.now()` at the tray-emptying capture minus `gamePlay.startTime`).
 */
function buildFinishedSolvableState(): AppState {
  return {
    ...buildAppStateWithHintOn(playToCompletion(buildFreshGame())),
    gamePlay: { startTime: Date.now() - 7_335_000 },
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

    // Top bar (§5.1/§5.6, Phase 14): the drag-fit-hint slot is the live icon component,
    // at rest in its `None` state — the info icon's slot, announcing "no piece is being
    // dragged" and re-announcing hint changes politely.
    const hintSlot = screen.getByRole("button", {
      name: "No piece is being dragged",
    });
    expect(hintSlot.getAttribute("aria-live")).toBe("polite");
    expect(hintSlot.querySelector("svg")).not.toBeNull();

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

/* -------------------------------------------------------------------------- */
/* §5.13 solvability indicator & game-finished dialog (Phase 15)               */
/* -------------------------------------------------------------------------- */

/** The top-bar solvability indicator, looked up by its announced label. */
function solvabilityIcon(label: string): SVGElement | null {
  const svgs = document.querySelectorAll("svg[role='img']");
  for (const svg of svgs) {
    if (svg.querySelector("title")?.textContent === label)
      return svg as SVGElement;
  }
  return null;
}

describe("App shell §5.13 — solvability indicator (Phase 15)", () => {
  it("shows the happy face when `hintGameIsSolvable` is on and the position is solvable", () => {
    renderApp(buildAppStateWithHintOn());

    expect(solvabilityIcon("Position is solvable")).not.toBeNull();
    expect(
      solvabilityIcon("Position is solvable")?.parentElement?.getAttribute("aria-live"),
    ).toBe("polite");
    // Exactly one face: the unsolvable icon is absent.
    expect(solvabilityIcon("No solution exists")).toBeNull();
  });

  it("shows the sad face when `hintGameIsSolvable` is on and the position is not solvable", () => {
    renderApp(buildAppStateWithHintOn(buildUnsolvableFinishedGame()));

    expect(solvabilityIcon("No solution exists")).not.toBeNull();
    expect(
      solvabilityIcon("No solution exists")?.parentElement?.getAttribute("aria-live"),
    ).toBe("polite");
    expect(solvabilityIcon("Position is solvable")).toBeNull();
  });

  it("shows no solvability icon at all when `hintGameIsSolvable` is off, regardless of solvability", () => {
    // `PREFERENCES` carries `gameIsSolvable: false` (the test default).
    renderApp(buildAppState(buildUnsolvableFinishedGame()));
    expect(solvabilityIcon("Position is solvable")).toBeNull();
    expect(solvabilityIcon("No solution exists")).toBeNull();
    cleanup();
    renderApp(buildAppState());
    expect(solvabilityIcon("Position is solvable")).toBeNull();
    expect(solvabilityIcon("No solution exists")).toBeNull();
  });
});

describe("App shell §5.13 — game-finished dialog (Phase 15)", () => {
  it("stays closed while the tray still holds pieces (including a fresh game start)", () => {
    renderApp(buildAppStateWithHintOn());

    expect(screen.queryByText("Game finished")).toBeNull();
  });

  it("opens with the success alert and the `{h}h {m}m {s}s` elapsed string when the tray empties solvable", () => {
    renderApp(buildFinishedSolvableState());

    expect(screen.getByText("Game finished")).toBeTruthy();
    // §5.13: the success alert is a success-severity Alert (MUI v9 roots both
    // severities at `role="alert"`; the severity is the `MuiAlert-colorSuccess`
    // class) carrying the §5.13 elapsed string — the `Date.now()` at the
    // tray-emptying capture minus `gamePlay.startTime`, which the fixture
    // back-dated exactly 2h 2m 15s. Exactly one alert is present, and it is the
    // success one.
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].className).toContain("MuiAlert-colorSuccess");
    expect(alerts[0].textContent).toContain("Solved in 2h 2m 15s");
  });

  it("freezes the elapsed string at the tray-emptying moment — the string does not keep advancing", () => {
    vi.useFakeTimers();
    try {
      // The fixture back-dates `gamePlay.startTime` exactly 2h 2m 15s from the
      // (mocked) "now", so the value captured when the tray empties is
      // deterministically `2h 2m 15s`.
      renderApp(buildFinishedSolvableState());

      expect(
        screen.getAllByRole("alert")[0].textContent,
      ).toContain("Solved in 2h 2m 15s");

      // Advance the (mocked) clock 5s while the Dialog is open: a live
      // `now − startTime` read would advance the string to `2h 2m 20s`. The
      // §5.13 string must stay static at the captured value.
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(
        screen.getAllByRole("alert")[0].textContent,
      ).toContain("Solved in 2h 2m 15s");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens with the failure alert only — no elapsed-time string — when the tray empties unsolvable", () => {
    renderApp(buildAppStateWithHintOn(buildUnsolvableFinishedGame()));

    expect(screen.getByText("Game finished")).toBeTruthy();
    // §5.13: the failure alert is an error-severity Alert with no elapsed-time
    // string.
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].className).toContain("MuiAlert-colorError");
    expect(alerts[0].textContent).toContain(
      "No solution exists for this position.",
    );
    expect(screen.queryByText(/Solved in/)).toBeNull();
    // And the top-bar indicator agrees: the sad face.
    expect(solvabilityIcon("No solution exists")).not.toBeNull();
  });

  it("dismisses on Escape without any shell-telescope emission, and the top bar stays reachable", () => {
    vi.useFakeTimers();
    try {
      const { telescope } = renderApp(buildFinishedSolvableState());
      const emissions: AppState[] = [];
      const subscription = telescope.stream.subscribe((s) => emissions.push(s));

      expect(screen.getByText("Game finished")).toBeTruthy();

      // §5.13 recovery loop: the dismissal is MUI's Escape path → the shell's
      // `onGameFinishedDialogClose` action → the state tier's local dismissal
      // flag. No `AppState` write happens, so the shell telescope re-emits
      // nothing — the dialog's open state is a pure derivation. MUI's Modal
      // listens for the Escape keydown on its own root element (it bubbles up
      // from anywhere inside the dialog), not on `document` — so the event is
      // fired on the dialog's content, the way a user's keystroke would land.
      fireEvent.keyDown(screen.getByText("Game finished"), { key: "Escape" });
      // MUI settles the Dialog's exit transition on its own timer (as the
      // Phase 11 Snackbar test does), so advance before asserting the DOM.
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByText("Game finished")).toBeNull();
      expect(emissions).toHaveLength(1); // only the replayed initial state
      // The player can now reach the shell's controls (the video's guidance:
      // "press undo until the happy face reappears").
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      subscription.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-opens the next time the tray empties after a dismissal (the dismissal resets when the tray refills)", () => {
    vi.useFakeTimers();
    try {
      const finished = buildFinishedSolvableState();
      const { telescope } = renderApp(finished);

      expect(screen.getByText("Game finished")).toBeTruthy();

      // Dismiss it (Escape on the dialog's content — MUI listens on the modal
      // root, where the keystroke bubbles up), and let MUI settle the Dialog's
      // exit transition (its own timer — the Phase 11 test's convention) so the
      // assertions below see a fully unmounted dialog, not one mid-exit.
      fireEvent.keyDown(screen.getByText("Game finished"), { key: "Escape" });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByText("Game finished")).toBeNull();

      // The tray refills — as a Phase 10 undo would — committed through the shell
      // telescope. The dialog must stay closed with it (tray not empty), and the
      // dismissal must reset in the state tier's refill effect.
      act(() => {
        telescope.update(buildAppStateWithHintOn());
      });
      expect(screen.queryByText("Game finished")).toBeNull();

      // And the tray empties again → the dialog opens AGAIN: the earlier
      // dismissal did not outlive the empty tray it was applied to.
      act(() => {
        telescope.update(finished);
      });
      expect(screen.getByText("Game finished")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
