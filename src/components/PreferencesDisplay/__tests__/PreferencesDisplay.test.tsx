import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { Telescope } from "telescopejs";
import { useTelescopeState } from "../../../base/useTelescopeState";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import type { AppPreferences } from "../../../App.types";
import { PreferencesDisplay } from "../PreferencesDisplay";
import { darkTheme } from "../../../theme";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals`
// mode is on; here it is off, so unmount explicitly (same convention as the
// Phase 5/7/15 tests).
afterEach(() => {
  cleanup();
});

/** §4.2 defaults — the panel's first-load state. */
const DEFAULTS = {
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

/**
 * The slice's host: `main.tsx`'s root subscription factored into a component
 * for the test harness — `PreferencesDisplay` is snapshot-in, telescope-out
 * (requirements §7.2), so a test that commits through the slice sees the panel
 * re-render only through this same subscription path.
 */
function PanelHarness(
  props: TelescopedProps<AppPreferences>,
): React.ReactElement {
  const state = useTelescopeState(props.telescope, props.state);
  return <PreferencesDisplay state={state} telescope={props.telescope} />;
}

function renderPanel(initial: AppPreferences = DEFAULTS) {
  const telescope = Telescope.of(initial);
  const emissions: AppPreferences[] = [];
  const subscription = telescope.stream.subscribe((s) => emissions.push(s));
  const utils = render(
    <ThemeProvider theme={darkTheme}>
      <PanelHarness state={initial} telescope={telescope} />
    </ThemeProvider>,
  );
  return { ...utils, telescope, emissions, subscription };
}

/**
 * The DOM node behind one `role="switch"`/`role="radio"` query is the MUI
 * control's `<input>` (testing-library types it as `HTMLElement`); this narrows
 * it so its `.checked` can be read.
 */
function asInput(el: HTMLElement): HTMLInputElement {
  return el as HTMLInputElement;
}

/** The §5.8 boolean rows' exact labels, in table order. */
const BOOLEAN_LABELS = [
  "Hint Fit Piece Count",
  "Hint Fit Piece Unique Cell",
  "Hint Piece Cells",
  "Hint Fit On Drag",
  "Show Fit Pieces on Hover",
  "Prevent Invalid Moves",
  "Hint Game Is Solvable",
  "Sound",
] as const;

describe("PreferencesDisplay (§5.8)", () => {
  it("renders exactly 9 rows in §5.8's table order: the pieceType radio row first, then the 8 switches, each labelled with the table's exact text", () => {
    renderPanel();

    // The 8 boolean rows: MUI `Switch` inputs (role="switch"), one per §5.8
    // label, in the table's order.
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(8);
    for (const label of BOOLEAN_LABELS) {
      expect(screen.getByRole("switch", { name: label })).toBeTruthy();
    }

    // The pieceType row: one radio group with exactly the two §5.8 options,
    // each labelled with its option text (the accessible name comes from the
    // FormControlLabel's `<label>`, not an aria attribute).
    const radioGroup = screen.getByRole("radiogroup");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Shapes" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Faces" })).toBeTruthy();
    expect(screen.getByText("Piece Type: Shapes or Faces").parentElement).toBe(
      radioGroup.parentElement,
    );

    // §5.8 table order: the pieceType row precedes the first switch row.
    const pieceTypeLabel = screen.getByText("Piece Type: Shapes or Faces");
    const firstSwitchRow = screen
      .getByRole("switch", { name: BOOLEAN_LABELS[0] })
      .closest("label");
    if (firstSwitchRow === null)
      throw new Error("fixture: first switch row lost its label");
    expect(
      pieceTypeLabel.compareDocumentPosition(firstSwitchRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("reflects the slice's current values on mount (a non-default state renders its own values)", () => {
    renderPanel({
      ...DEFAULTS,
      pieceType: "Faces",
      hints: { ...DEFAULTS.hints, fitPieceCount: false },
      sound: false,
    });

    const shapes = asInput(screen.getByRole("radio", { name: "Shapes" }));
    const faces = asInput(screen.getByRole("radio", { name: "Faces" }));
    expect(faces.checked).toBe(true);
    expect(shapes.checked).toBe(false);
    expect(
      asInput(screen.getByRole("switch", { name: "Hint Fit Piece Count" }))
        .checked,
    ).toBe(false);
    expect(asInput(screen.getByRole("switch", { name: "Sound" })).checked).toBe(
      false,
    );
    // A sibling hint keeps its own value.
    expect(
      asInput(screen.getByRole("switch", { name: "Hint Fit On Drag" })).checked,
    ).toBe(true);
  });

  it("toggles one boolean row through the slice telescope: one emission, exactly that field flipped, its row re-rendered off", () => {
    const { emissions, subscription } = renderPanel();

    fireEvent.click(screen.getByRole("switch", { name: "Sound" }));

    // Replayed initial state + exactly one committed update.
    expect(emissions).toHaveLength(2);
    const next = emissions[1];
    expect(next).not.toBe(DEFAULTS);
    expect(next.sound).toBe(false);
    // Mutual independence (§5.8): no other field moved.
    expect(next.hints).toBe(DEFAULTS.hints);
    expect(next.preventInvalidMoves).toBe(true);
    expect(next.pieceType).toBe("Shapes");

    // The slice host re-rendered on the emission: the row now reads `false`.
    expect(asInput(screen.getByRole("switch", { name: "Sound" })).checked).toBe(
      false,
    );
    subscription.unsubscribe();
  });

  it("toggling every row away from its default commits one emission per row, in sequence, with no cross-talk", () => {
    const { emissions, subscription } = renderPanel();

    for (const label of BOOLEAN_LABELS) {
      fireEvent.click(screen.getByRole("switch", { name: label }));
    }

    // 9 total: the replay + one per row.
    expect(emissions).toHaveLength(9);
    const last = emissions[8];
    expect(last.hints.fitPieceCount).toBe(false);
    expect(last.hints.availablePieceUniqueCell).toBe(false);
    expect(last.hints.pieceCells).toBe(true); // was the only hint defaulting off
    expect(last.hints.fitOnDrag).toBe(false);
    expect(last.hints.showFitPiecesOnHover).toBe(false);
    expect(last.hints.gameIsSolvable).toBe(false);
    expect(last.hints.availablePiecesCount).toBe(true); // not a §5.8 row: untouched
    expect(last.preventInvalidMoves).toBe(false);
    expect(last.sound).toBe(false);
    expect(last.pieceType).toBe("Shapes"); // still untouched by the switches
    subscription.unsubscribe();
  });

  it("selects 'Faces' through the pieceType row: one emission, pieceType written as the string value, the radio re-rendered selected", () => {
    const { emissions, subscription } = renderPanel();

    fireEvent.click(screen.getByRole("radio", { name: "Faces" }));

    expect(emissions).toHaveLength(2);
    expect(emissions[1].pieceType).toBe("Faces");
    expect(emissions[1].hints).toBe(DEFAULTS.hints);
    expect(asInput(screen.getByRole("radio", { name: "Faces" })).checked).toBe(
      true,
    );
    expect(asInput(screen.getByRole("radio", { name: "Shapes" })).checked).toBe(
      false,
    );
    subscription.unsubscribe();
  });

  it("re-selecting the held pieceType no-ops: clicking the already-checked radio fires no commit, so no further emission", () => {
    const { emissions, subscription } = renderPanel();

    // `Shapes` is already the held value: re-clicking the already-checked
    // radio is a browser no-op (no change event), so no commit reaches the
    // slice and the stream re-emits nothing.
    fireEvent.click(screen.getByRole("radio", { name: "Shapes" }));
    fireEvent.click(screen.getByRole("radio", { name: "Shapes" }));

    // Only the replayed initial state.
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toBe(DEFAULTS);
    subscription.unsubscribe();
  });

  it("a switch round-trips: off then back on commits one emission per flip and restores the held value", () => {
    const { emissions, subscription } = renderPanel();

    // `Hint Piece Cells` defaults to off: on, then off again.
    fireEvent.click(screen.getByRole("switch", { name: "Hint Piece Cells" }));
    fireEvent.click(screen.getByRole("switch", { name: "Hint Piece Cells" }));

    // Replay + two flips.
    expect(emissions).toHaveLength(3);
    expect(emissions[1].hints.pieceCells).toBe(true);
    expect(emissions[2].hints.pieceCells).toBe(false);
    expect(emissions[2].hints).toEqual(DEFAULTS.hints);
    expect(
      asInput(screen.getByRole("switch", { name: "Hint Piece Cells" })).checked,
    ).toBe(false);
    subscription.unsubscribe();
  });
});
