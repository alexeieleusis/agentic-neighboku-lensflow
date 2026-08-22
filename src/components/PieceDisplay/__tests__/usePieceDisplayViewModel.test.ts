import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { Telescope } from "telescopejs";
import { createPiece } from "../../../game/entities";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import { usePieceDisplayViewModel } from "../usePieceDisplayViewModel";
import type { PieceDisplayState } from "../PieceDisplay.types";

// The hook is a pure leaf derivation (no local state, no actions, no telescope writes),
// so it's exercised through its inputs: different `state` snapshots must yield the right
// §5.3 attributes. The telescope is required by the props shape but unused by the leaf.
function renderViewModel(
  piece: readonly number[],
  dimension: number,
  size: number,
) {
  const state: PieceDisplayState = {
    piece: createPiece(piece, dimension, 3),
    size,
  };
  const props: TelescopedProps<PieceDisplayState> = {
    state,
    telescope: Telescope.of(state),
  };
  return renderHook(() => usePieceDisplayViewModel(props));
}

describe("usePieceDisplayViewModel (§5.3)", () => {
  it("maps a 3-d piece to its form, colors, stroke width, and size", () => {
    const { result } = renderViewModel([0, 1, 0], 3, 96);
    expect(result.current).toEqual({
      form: "circle",
      strokeColor: "dodgerblue",
      fillColor: "aquamarine",
      strokeWidth: 4,
      size: 96,
      ariaLabel: "circle, dodgerblue border, aquamarine fill",
    });
  });

  it("maps a square to its §5.3 stroke width 4", () => {
    const { result } = renderViewModel([2, 2, 2], 3, 48);
    expect(result.current.form).toBe("square");
    expect(result.current.strokeWidth).toBe(4);
    expect(result.current.strokeColor).toBe("mediumseagreen");
    expect(result.current.fillColor).toBe("purple");
  });

  it("falls back the fill to the stroke color for a 2-d piece", () => {
    const { result } = renderViewModel([1, 2], 2, 48);
    expect(result.current.form).toBe("triangle");
    expect(result.current.strokeWidth).toBe(4);
    expect(result.current.strokeColor).toBe("mediumseagreen");
    expect(result.current.fillColor).toBe("mediumseagreen");
  });

  it("is deterministic for equal piece values", () => {
    const a = renderViewModel([1, 0, 1], 3, 48);
    const b = renderViewModel([1, 0, 1], 3, 48);
    expect(a.result.current).toEqual(b.result.current);
  });
});
