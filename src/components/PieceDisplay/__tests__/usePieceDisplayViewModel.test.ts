import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { Telescope } from "telescopejs";
import { createPiece } from "../../../game/entities";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import { usePieceDisplayViewModel } from "../usePieceDisplayViewModel";
import type { PieceType } from "../../CellDisplay/CellDisplay.types";
import type { PieceDisplayState } from "../PieceDisplay.types";

// The hook is a pure leaf derivation (no local state, no actions, no telescope writes),
// so it's exercised through its inputs: different `state` snapshots must yield the right
// §5.3/§5.4 attributes. The telescope is required by the props shape but unused by the leaf.
function renderViewModel(
  piece: readonly number[],
  dimension: number,
  size: number,
  pieceType: PieceType = "Shapes",
) {
  const state: PieceDisplayState = {
    piece: createPiece(piece, dimension, 3),
    size,
    pieceType,
  };
  const props: TelescopedProps<PieceDisplayState> = {
    state,
    telescope: Telescope.of(state),
  };
  return renderHook(() => usePieceDisplayViewModel(props));
}

describe("usePieceDisplayViewModel (§5.3 Shapes)", () => {
  it("maps a 3-d piece to its form, colors, stroke width, and size", () => {
    const { result } = renderViewModel([0, 1, 0], 3, 96);
    expect(result.current).toEqual({
      pieceType: "Shapes",
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
    const vm = result.current;
    expect(vm.pieceType).toBe("Shapes");
    if (vm.pieceType !== "Shapes") throw new Error("narrow");
    expect(vm.form).toBe("square");
    expect(vm.strokeWidth).toBe(4);
    expect(vm.strokeColor).toBe("mediumseagreen");
    expect(vm.fillColor).toBe("purple");
  });

  it("falls back the fill to the stroke color for a 2-d piece", () => {
    const { result } = renderViewModel([1, 2], 2, 48);
    const vm = result.current;
    if (vm.pieceType !== "Shapes") throw new Error("narrow");
    expect(vm.form).toBe("triangle");
    expect(vm.strokeWidth).toBe(4);
    expect(vm.strokeColor).toBe("mediumseagreen");
    expect(vm.fillColor).toBe("mediumseagreen");
  });

  it("is deterministic for equal piece values", () => {
    const a = renderViewModel([1, 0, 1], 3, 48);
    const b = renderViewModel([1, 0, 1], 3, 48);
    expect(a.result.current).toEqual(b.result.current);
  });
});

describe("usePieceDisplayViewModel (§5.4 Faces)", () => {
  it("maps a piece to its §5.4 face image path and accessible label", () => {
    const { result } = renderViewModel([0, 1, 2], 3, 96, "Faces");
    expect(result.current).toEqual({
      pieceType: "Faces",
      faceImagePath: "/faces/h0e1m2.png",
      size: 96,
      ariaLabel: "face, hair 0, eyes 1, mouth 2",
    });
  });

  it("maps h/e/m to piece[0]/piece[1]/piece[2] exactly", () => {
    const { result } = renderViewModel([2, 0, 1], 3, 32, "Faces");
    const vm = result.current;
    if (vm.pieceType !== "Faces") throw new Error("narrow");
    expect(vm.faceImagePath).toBe("/faces/h2e0m1.png");
    expect(vm.ariaLabel).toBe("face, hair 2, eyes 0, mouth 1");
  });

  it("defaults the mouth digit to 0 for a 2-dimensional piece", () => {
    const { result } = renderViewModel([1, 2], 2, 48, "Faces");
    const vm = result.current;
    if (vm.pieceType !== "Faces") throw new Error("narrow");
    expect(vm.faceImagePath).toBe("/faces/h1e2m0.png");
  });

  it("is independent of the size (the skin is a pure function of the piece value)", () => {
    const a = renderViewModel([0, 2, 0], 3, 32, "Faces");
    const b = renderViewModel([0, 2, 0], 3, 96, "Faces");
    const va = a.result.current;
    const vb = b.result.current;
    if (va.pieceType !== "Faces" || vb.pieceType !== "Faces")
      throw new Error("narrow");
    expect(va.faceImagePath).toBe(vb.faceImagePath);
    expect(va.ariaLabel).toBe(vb.ariaLabel);
  });
});
