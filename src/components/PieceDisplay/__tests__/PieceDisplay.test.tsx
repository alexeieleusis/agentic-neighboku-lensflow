import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Telescope } from "telescopejs";
import { createPiece, type Piece } from "../../../game/entities";
import { PieceDisplay } from "../PieceDisplay";
import type { PieceDisplayState } from "../PieceDisplay.types";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals` mode is on;
// here it is off, so unmount explicitly (same convention as the Phase 5 BoardDisplay test).
afterEach(() => {
  cleanup();
});

/** Render one `PieceDisplay` for a piece and hand back the DOM container for shape queries. */
function renderPiece(piece: Piece, size = 48) {
  const state = { piece, size } satisfies PieceDisplayState;
  const telescope = Telescope.of(state);
  return render(<PieceDisplay state={state} telescope={telescope} />);
}

/** Every `base=3, dimension=3` piece value, in row-major `piece[0]`..`piece[2]` order. */
function allShapesPieces(): readonly Piece[] {
  const out: Piece[] = [];
  for (const form of [0, 1, 2]) {
    for (const stroke of [0, 1, 2]) {
      for (const fill of [0, 1, 2]) out.push(createPiece([form, stroke, fill], 3, 3));
    }
  }
  return out;
}

describe("PieceDisplay (Shapes mode) §5.3", () => {
  it("renders a circle for piece[0]=0 with §5.3 r=15 and stroke 5", () => {
    const { container } = renderPiece(createPiece([0, 1, 0], 3, 3));
    const circle = container.querySelector("circle");
    if (!circle) throw new Error("Expected a <circle> element");
    expect(circle.getAttribute("r")).toBe("15");
    expect(circle.getAttribute("stroke")).toBe("dodgerblue");
    expect(circle.getAttribute("fill")).toBe("aquamarine");
    expect(circle.getAttribute("stroke-width")).toBe("5");
  });

  it("renders an equilateral triangle for piece[0]=1 with stroke 4", () => {
    const { container } = renderPiece(createPiece([1, 2, 1], 3, 3));
    const polygon = container.querySelector("polygon");
    expect(polygon?.getAttribute("stroke")).toBe("mediumseagreen");
    expect(polygon?.getAttribute("fill")).toBe("yellow");
    expect(polygon?.getAttribute("stroke-width")).toBe("4");
    expect(polygon?.getAttribute("points")?.trim().split(/\s+/).length).toBe(3);
  });

  it("renders a square/rect for piece[0]=2 with stroke 10", () => {
    const { container } = renderPiece(createPiece([2, 0, 2], 3, 3));
    const rect = container.querySelector("rect");
    expect(rect?.getAttribute("stroke")).toBe("red");
    expect(rect?.getAttribute("fill")).toBe("purple");
    expect(rect?.getAttribute("stroke-width")).toBe("10");
  });

  it("falls back the fill to the stroke color for a 2-dimensional piece", () => {
    const { container } = renderPiece(createPiece([1, 2], 2, 3));
    const polygon = container.querySelector("polygon");
    expect(polygon?.getAttribute("fill")).toBe("mediumseagreen");
    expect(polygon?.getAttribute("stroke")).toBe("mediumseagreen");
  });

  it("gives every base-3 piece a visually distinct shape/stroke/fill combination", () => {
    const pieces = allShapesPieces();
    const { container } = render(
      <div>
        {pieces.map((piece) => {
          const state = { piece, size: 48 } satisfies PieceDisplayState;
          const telescope = Telescope.of(state);
          return (
            <PieceDisplay key={piece.join("·")} state={state} telescope={telescope} />
          );
        })}
      </div>,
    );

    const shapes = container.querySelectorAll("svg[role='img']");
    expect(shapes.length).toBe(27);
    const labels = new Set(Array.from(shapes).map((s) => s.getAttribute("aria-label")));
    expect(labels.size).toBe(27);

    // Each form occupies exactly 9 of the 27 (3 strokes × 3 fills).
    expect(container.querySelectorAll("circle").length).toBe(9);
    expect(container.querySelectorAll("polygon").length).toBe(9);
    expect(container.querySelectorAll("rect").length).toBe(9);
  });

  it("exposes an accessible role and label on its svg", () => {
    const { container } = renderPiece(createPiece([0, 0, 0], 3, 3));
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe(
      "circle, red border, aquamarine fill",
    );
  });
});
