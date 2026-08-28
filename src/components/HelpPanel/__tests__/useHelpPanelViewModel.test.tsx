import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { Telescope } from "telescopejs";
import { useHelpPanelViewModel } from "../useHelpPanelViewModel";
import { HELP_PIECE_IMAGE_PX } from "../useHelpPanelDomain";
import { faceImagePathFor } from "../../PieceDisplay/pieceFaceTables";
import type { PieceType } from "../../CellDisplay/CellDisplay.types";
import type { HelpPanelState } from "../HelpPanel.types";

/** The `renderHelpPanelSlice`/inline-rerender fixture's slice-movable fields. */
interface MovableSlice {
  base: number;
  dimension: number;
  pieceType: PieceType;
}

/** The shipped configuration: base 3, dimension 3 — the 27-piece candidate space. */
function renderHelpPanel(overrides: Partial<HelpPanelState> = {}) {
  return renderHook(() =>
    useHelpPanelViewModel({
      state: { base: 3, dimension: 3, pieceType: "Shapes", ...overrides },
      telescope: Telescope.of<HelpPanelState>({
        base: 3,
        dimension: 3,
        pieceType: "Shapes",
        ...overrides,
      }),
    }),
  );
}

/**
 * The slice-movable variant of `renderHelpPanel`: `initialProps` keeps `state`
 * and `telescope` re-derived from the same `{ base, dimension, pieceType }` on
 * every render, so `rerender` can move the slice — the Phase 17 New Game path
 * re-derives `HELP_PANEL_LENS` at a different size, and the Phase 19 §4.2 skin
 * toggle moves it between the two §5.4 skins, neither of which the closed-over
 * `renderHelpPanel` can express.
 */
function renderHelpPanelSlice() {
  return renderHook(
    (slice: MovableSlice) =>
      useHelpPanelViewModel({
        state: {
          base: slice.base,
          dimension: slice.dimension,
          pieceType: slice.pieceType,
        },
        telescope: Telescope.of<HelpPanelState>({
          base: slice.base,
          dimension: slice.dimension,
          pieceType: slice.pieceType,
        }),
      }),
    { initialProps: { base: 3, dimension: 3, pieceType: "Shapes" } },
  );
}

describe("useHelpPanelViewModel (§5.10 no-selection state)", () => {
  it("starts with no piece selected: the placeholder state, with the full candidate space listed", () => {
    const { result } = renderHelpPanel();
    const vm = result.current;

    expect(vm.selectedPiece).toBeNull();
    expect(vm.selectedLabel).toBe("");
    // No selection → both neighbor sets empty (the sensible placeholder state,
    // never a crash or an unhandled undefined)…
    expect(vm.validNeighbors).toHaveLength(0);
    expect(vm.invalidNeighbors).toHaveLength(0);
    // …while the selector still lists the whole base^dimension space.
    expect(vm.candidatePieces).toHaveLength(27);
  });
});

describe("useHelpPanelViewModel (§5.10 selecting a piece)", () => {
  it("selecting a piece splits the candidate space into exactly 12 valid and 15 invalid neighbors at base 3, dimension 3", () => {
    const { result } = renderHelpPanel();

    act(() => {
      result.current.onPieceSelect("0 0 0");
    });

    const vm = result.current;
    expect(vm.selectedPiece?.join(",")).toBe("0,0,0");
    expect(vm.selectedLabel).toBe("0 0 0");
    expect(vm.validNeighbors).toHaveLength(12);
    expect(vm.invalidNeighbors).toHaveLength(15);
    // The two sets partition the candidate space: no overlap, no omissions.
    expect(vm.validNeighbors.length + vm.invalidNeighbors.length).toBe(
      vm.candidatePieces.length,
    );
    const validLabels = new Set(vm.validNeighbors.map((entry) => entry.label));
    for (const entry of vm.invalidNeighbors) {
      expect(validLabels.has(entry.label)).toBe(false);
    }
    // The selected piece itself is an invalid neighbor of itself…
    expect(vm.invalidNeighbors.some((entry) => entry.label === "0 0 0")).toBe(
      true,
    );
    // …and is not among the valid neighbors.
    expect(validLabels.has("0 0 0")).toBe(false);
  });

  it("re-selecting another piece recomputes both sets for the new piece", () => {
    const { result } = renderHelpPanel();

    act(() => {
      result.current.onPieceSelect("0 0 0");
    });
    const first = result.current.validNeighbors.map((entry) => entry.label);

    act(() => {
      result.current.onPieceSelect("2 2 2");
    });
    const vm = result.current;
    expect(vm.selectedPiece?.join(",")).toBe("2,2,2");
    const second = vm.validNeighbors.map((entry) => entry.label);
    expect(second).toHaveLength(12);
    // The valid set moved with the selection: [0,0,0] is a valid neighbor of
    // [2,2,2]? No — they share zero attributes, so it must be on the invalid side.
    expect(second).not.toContain("0 0 0");
    expect(vm.invalidNeighbors.some((entry) => entry.label === "0 0 0")).toBe(
      true,
    );
    // And the previous selection's valid set is not simply carried over.
    expect(second).not.toEqual(first);
  });

  it("selecting the no-selection option returns to the placeholder state", () => {
    const { result } = renderHelpPanel();

    act(() => {
      result.current.onPieceSelect("0 0 0");
    });
    expect(result.current.validNeighbors).toHaveLength(12);

    act(() => {
      result.current.onPieceSelect("");
    });
    const vm = result.current;
    expect(vm.selectedPiece).toBeNull();
    expect(vm.selectedLabel).toBe("");
    expect(vm.validNeighbors).toHaveLength(0);
    expect(vm.invalidNeighbors).toHaveLength(0);
    // The candidate space is untouched by the selection round-trip.
    expect(vm.candidatePieces).toHaveLength(27);
  });

  it("an unknown label resolves to the no-selection state through the view model (the domain tier's `null` resolution, committed by the action tier)", () => {
    const { result } = renderHelpPanel();

    act(() => {
      result.current.onPieceSelect("0 0 0");
    });
    expect(result.current.validNeighbors).toHaveLength(12);

    // "9 9 9" holds no member of the base-3 space: `resolvePieceByLabel`
    // resolves it to `null`, and the action tier commits that.
    act(() => {
      result.current.onPieceSelect("9 9 9");
    });
    const vm = result.current;
    expect(vm.selectedPiece).toBeNull();
    expect(vm.selectedLabel).toBe("");
    expect(vm.validNeighbors).toHaveLength(0);
    expect(vm.invalidNeighbors).toHaveLength(0);
    // The candidate space is untouched.
    expect(vm.candidatePieces).toHaveLength(27);
  });

  it("hands every rendered piece to the shared PieceDisplay through its own magnified slice at the panel's render size", () => {
    const { result } = renderHelpPanel();

    act(() => {
      result.current.onPieceSelect("0 0 0");
    });
    const vm = result.current;
    const entry = [
      ...vm.candidatePieces,
      ...vm.validNeighbors,
      ...vm.invalidNeighbors,
    ][0];
    expect(entry.image.state.piece.join(",")).toBe(entry.piece.join(","));
    expect(entry.image.state.size).toBe(HELP_PIECE_IMAGE_PX);
    // The slice's telescope is a real (magnified) telescope, not a stand-in.
    expect(typeof entry.image.telescope.update).toBe("function");
  });
});

describe("useHelpPanelViewModel (§5.10 selection reset on slice move)", () => {
  it("a selection from the old candidate space never renders against the new one: re-deriving the slice at a different size resets to the placeholder", () => {
    const { result, rerender } = renderHelpPanelSlice();

    act(() => {
      result.current.onPieceSelect("0 0 0");
    });
    const vmBefore = result.current;
    expect(vmBefore.validNeighbors).toHaveLength(12);
    expect(vmBefore.invalidNeighbors).toHaveLength(15);

    // The Phase 17 New Game commit re-derives `HELP_PANEL_LENS` at a
    // different size; the shell re-renders the panel against the new slice.
    rerender({ base: 3, dimension: 2, pieceType: "Shapes" });
    const vm = result.current;
    // Without the reset, the panel would keep rendering sets for [0,0,0] —
    // a piece no longer in the 9-piece space — and the selector would show a
    // label matching no option.
    expect(vm.selectedPiece).toBeNull();
    expect(vm.selectedLabel).toBe("");
    expect(vm.validNeighbors).toHaveLength(0);
    expect(vm.invalidNeighbors).toHaveLength(0);
    // The selector lists the new 3^2 space, in full.
    expect(vm.candidatePieces).toHaveLength(9);
  });

  it("resets within the slice-move render itself: no post-paint reset frame (a stale selection never computes a set against the new space)", () => {
    let renders = 0;
    const { result, rerender } = renderHook(
      (slice: MovableSlice) => {
        renders += 1;
        return useHelpPanelViewModel({
          state: {
            base: slice.base,
            dimension: slice.dimension,
            pieceType: slice.pieceType,
          },
          telescope: Telescope.of<HelpPanelState>({
            base: slice.base,
            dimension: slice.dimension,
            pieceType: slice.pieceType,
          }),
        });
      },
      { initialProps: { base: 3, dimension: 3, pieceType: "Shapes" } },
    );

    act(() => {
      result.current.onPieceSelect("0 0 0");
    });
    // The mount render plus the selection's state update.
    expect(renders).toBe(2);

    // The Phase 17 New Game commit re-derives `HELP_PANEL_LENS` at a
    // different size; the shell re-renders the panel against the new slice.
    // The reset is part of THIS render (the effective selection is derived
    // synchronously from the new candidate space): a post-paint `useEffect`
    // reset would have computed both neighbor sets from the stale selection
    // in this render — one painted frame in which "the two sets partition
    // the candidate space" does not hold — and then re-rendered again after
    // clearing.
    rerender({ base: 3, dimension: 2, pieceType: "Shapes" });
    expect(renders).toBe(3);
    const vm = result.current;
    expect(vm.selectedPiece).toBeNull();
    expect(vm.validNeighbors).toHaveLength(0);
    expect(vm.invalidNeighbors).toHaveLength(0);
  });
});

describe("useHelpPanelViewModel (§5.4 pieceType reaches every piece display)", () => {
  it("forwards the slice's pieceType into every piece-image slice it hands out", () => {
    const { result } = renderHelpPanel({ pieceType: "Faces" });

    act(() => {
      result.current.onPieceSelect("0 0 0");
    });
    const vm = result.current;
    const entries = [
      ...vm.candidatePieces,
      ...vm.validNeighbors,
      ...vm.invalidNeighbors,
    ];
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.image.state.pieceType).toBe("Faces");
      expect(entry.image.state.piece.join(",")).toBe(entry.piece.join(","));
      expect(entry.image.state.size).toBe(HELP_PIECE_IMAGE_PX);
      // The face image path the slice renders is the §5.4 mapping of the
      // entry's own piece (`pieceFaceTables`, the shared component's table —
      // the panel builds no second piece-rendering path).
      const digits = entry.piece;
      const mouth = digits.length > 2 ? digits[2] : 0;
      expect(faceImagePathFor(digits)).toBe(
        `/faces/h${digits[0]}e${digits[1]}m${mouth}.png`,
      );
    }
  });

  it("a §4.2 skin toggle re-derives the piece-image slices: Shapes → Faces on the same selection", () => {
    const { result, rerender } = renderHelpPanelSlice();

    act(() => {
      result.current.onPieceSelect("0 0 0");
    });
    const shapesEntries = [
      ...result.current.candidatePieces,
      ...result.current.validNeighbors,
      ...result.current.invalidNeighbors,
    ];
    expect(
      shapesEntries.every((entry) => entry.image.state.pieceType === "Shapes"),
    ).toBe(true);

    // The Preferences panel's pieceType commit re-derives `HELP_PANEL_LENS`
    // with the new skin; the shell re-renders the panel against the new slice
    // and every piece-image slice switches with it.
    rerender({ base: 3, dimension: 3, pieceType: "Faces" });
    const facesEntries = [
      ...result.current.candidatePieces,
      ...result.current.validNeighbors,
      ...result.current.invalidNeighbors,
    ];
    expect(
      facesEntries.every((entry) => entry.image.state.pieceType === "Faces"),
    ).toBe(true);
    // The selection and the sets themselves are skin-independent.
    expect(result.current.selectedLabel).toBe("0 0 0");
    expect(result.current.validNeighbors).toHaveLength(12);
    expect(result.current.invalidNeighbors).toHaveLength(15);
  });
});
