import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { Telescope } from "telescopejs";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import type { AppPreferences } from "../../../App.types";
import { usePreferencesDisplayViewModel } from "../usePreferencesDisplayViewModel";
import { PIECE_TYPE_OPTIONS } from "../usePreferencesDisplayDomain";

/** §4.2 defaults — the fixture every row value is checked against. */
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
 * Render `usePreferencesDisplayViewModel` against a standalone slice telescope
 * (the panel's slice IS its whole state — no shell needed to exercise the
 * orchestrator).
 */
function renderViewModel(initial: AppPreferences = DEFAULTS) {
  const telescope = Telescope.of(initial);
  const emissions: AppPreferences[] = [];
  const subscription = telescope.stream.subscribe((s) => emissions.push(s));
  const { result, rerender } = renderHook(
    (state: AppPreferences) =>
      usePreferencesDisplayViewModel({
        state,
        telescope,
      } satisfies TelescopedProps<AppPreferences>),
    { initialProps: initial },
  );
  return { result, rerender, telescope, emissions, subscription };
}

describe("usePreferencesDisplayViewModel (Phase 16 orchestrator)", () => {
  it("derives the 9 rows in §5.8's exact table order, with the table's exact labels and the slice's current values", () => {
    const { result } = renderViewModel();
    const rows = result.current.rows;

    expect(rows).toHaveLength(9);

    // Row 1: the pieceType row — label, options, and the slice's current value.
    const [first, ...rest] = rows;
    expect(first.kind).toBe("segmented");
    if (first.kind !== "segmented") throw new Error("fixture: row 1 drifted");
    expect(first.label).toBe("Piece Type: Shapes or Faces");
    expect(first.value).toBe("Shapes");
    expect(first.options).toEqual(PIECE_TYPE_OPTIONS);

    // Rows 2–9: the 8 switches, §5.8 order, §5.8 labels, §4.2 default values.
    expect(rest.map((row) => row.kind)).toEqual(new Array(8).fill("switch"));
    expect(rest.map((row) => row.label)).toEqual([
      "Hint Fit Piece Count",
      "Hint Fit Piece Unique Cell",
      "Hint Piece Cells",
      "Hint Fit On Drag",
      "Show Fit Pieces on Hover",
      "Prevent Invalid Moves",
      "Hint Game Is Solvable",
      "Sound",
    ]);
    expect(
      rest.map((row) => (row.kind === "switch" ? row.checked : null)),
    ).toEqual([
      true, // fitPieceCount
      true, // availablePieceUniqueCell
      false, // pieceCells
      true, // fitOnDrag
      true, // showFitPiecesOnHover
      true, // preventInvalidMoves
      true, // gameIsSolvable
      true, // sound
    ]);
  });

  it("tracks the slice as the shell's preferences change (re-render on the emission)", () => {
    const faces = { ...DEFAULTS, pieceType: "Faces" } satisfies AppPreferences;
    const { result, rerender } = renderViewModel();
    expect(
      result.current.rows[0].kind === "segmented"
        ? result.current.rows[0].value
        : null,
    ).toBe("Shapes");

    rerender(faces);
    expect(
      result.current.rows[0].kind === "segmented"
        ? result.current.rows[0].value
        : null,
    ).toBe("Faces");
  });

  it("commits a boolean row through the slice telescope: one emission, exactly one field moved", () => {
    const { result, rerender, emissions, subscription } = renderViewModel();

    act(() => {
      const sound = result.current.rows[8];
      if (sound.kind !== "switch") throw new Error("fixture: row 9 drifted");
      sound.onChange(false);
    });

    // Replayed initial state + exactly one committed update.
    expect(emissions).toHaveLength(2);
    const next = emissions[1];
    expect(next).not.toBe(DEFAULTS);
    expect(next.sound).toBe(false);
    // Every sibling field is the same reference the input held.
    expect(next.hints).toBe(DEFAULTS.hints);
    expect(next.scalars).toBe(DEFAULTS.scalars);
    expect(next.pieceType).toBe(DEFAULTS.pieceType);

    // The shell re-renders on the emission: the row now reads the new value.
    rerender(next);
    const sound = result.current.rows[8];
    expect(sound.kind === "switch" ? sound.checked : null).toBe(false);
    subscription.unsubscribe();
  });

  it("commits the pieceType row through the slice telescope: 'Faces' lands, 'Shapes' follows", () => {
    const { result, rerender, emissions, subscription } = renderViewModel();

    act(() => {
      const pieceType = result.current.rows[0];
      if (pieceType.kind !== "segmented")
        throw new Error("fixture: row 1 drifted");
      pieceType.onChange("Faces");
    });
    expect(emissions).toHaveLength(2);
    expect(emissions[1].pieceType).toBe("Faces");
    expect(emissions[1].hints).toBe(DEFAULTS.hints);

    rerender(emissions[1]);
    act(() => {
      const pieceType = result.current.rows[0];
      if (pieceType.kind !== "segmented")
        throw new Error("fixture: row 1 drifted");
      pieceType.onChange("Shapes");
    });
    expect(emissions).toHaveLength(3);
    expect(emissions[2].pieceType).toBe("Shapes");
    subscription.unsubscribe();
  });

  it("re-selecting a row's held value is a no-op: the domain guard returns the input reference, so the stream re-emits nothing", () => {
    const { result, emissions, subscription } = renderViewModel();

    act(() => {
      // `sound` is already `true` in the defaults.
      const sound = result.current.rows[8];
      if (sound.kind !== "switch") throw new Error("fixture: row 9 drifted");
      sound.onChange(true);
      // `pieceType` is already `Shapes` in the defaults.
      const pieceType = result.current.rows[0];
      if (pieceType.kind !== "segmented")
        throw new Error("fixture: row 1 drifted");
      pieceType.onChange("Shapes");
    });

    // Only the replayed initial state — both commits no-opped.
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toBe(DEFAULTS);
    subscription.unsubscribe();
  });
});
