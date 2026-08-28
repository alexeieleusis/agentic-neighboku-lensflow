import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { Telescope } from "telescopejs";
import { useHelpPanelViewModel } from "../useHelpPanelViewModel";
import { HELP_PIECE_IMAGE_PX } from "../useHelpPanelDomain";
import type { HelpPanelState } from "../HelpPanel.types";

/** The shipped configuration: base 3, dimension 3 — the 27-piece candidate space. */
function renderHelpPanel(overrides: Partial<HelpPanelState> = {}) {
  return renderHook(() =>
    useHelpPanelViewModel({
      state: { base: 3, dimension: 3, ...overrides },
      telescope: Telescope.of<HelpPanelState>({
        base: 3,
        dimension: 3,
        ...overrides,
      }),
    }),
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
