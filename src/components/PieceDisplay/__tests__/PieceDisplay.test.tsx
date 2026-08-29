import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Telescope } from "telescopejs";
import { createPiece, type Piece } from "../../../game/entities";
import type { PieceType } from "../../CellDisplay/CellDisplay.types";
import { PieceDisplay } from "../PieceDisplay";
import type { PieceDisplayState } from "../PieceDisplay.types";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals` mode is on;
// here it is off, so unmount explicitly (same convention as the Phase 5 BoardDisplay test).
afterEach(() => {
  cleanup();
});

/** Render one `PieceDisplay` for a piece in a §4.2 skin and hand back the DOM container. */
// eslint-disable-next-line lensflow/require-smart-constructor-validation
function renderPiece(piece: Piece, size = 48, pieceType: PieceType = "Shapes") {
  const state = { piece, size, pieceType } satisfies PieceDisplayState;
  const telescope = Telescope.of(state);
  return render(<PieceDisplay state={state} telescope={telescope} />);
}

/** Query a container for a single element by selector; throws with context if absent. */
function requireElement(container: ParentNode, selector: string): Element {
  const el = container.querySelector(selector);
  if (!el) throw new Error(`Expected <${selector}> element not found`);
  return el;
}

/** Every `base=3, dimension=3` piece value, in row-major `piece[0]`..`piece[2]` order. */
function allPieces(): readonly Piece[] {
  const out: Piece[] = [];
  for (const h of [0, 1, 2]) {
    for (const e of [0, 1, 2]) {
      for (const m of [0, 1, 2]) out.push(createPiece([h, e, m], 3, 3));
    }
  }
  return out;
}

describe("PieceDisplay (Shapes mode) §5.3", () => {
  it("renders a circle for piece[0]=0 with §5.3 r=15 and stroke 4", () => {
    const { container } = renderPiece(createPiece([0, 1, 0], 3, 3));
    const circle = requireElement(container, "circle");
    expect(circle.getAttribute("r")).toBe("15");
    expect(circle.getAttribute("stroke")).toBe("dodgerblue");
    expect(circle.getAttribute("fill")).toBe("aquamarine");
    expect(circle.getAttribute("stroke-width")).toBe("4");
  });

  it("renders an equilateral triangle for piece[0]=1 with stroke 4", () => {
    const { container } = renderPiece(createPiece([1, 2, 1], 3, 3));
    const polygon = requireElement(container, "polygon");
    expect(polygon.getAttribute("stroke")).toBe("mediumseagreen");
    expect(polygon.getAttribute("fill")).toBe("yellow");
    expect(polygon.getAttribute("stroke-width")).toBe("4");
    expect(polygon.getAttribute("points")?.trim().split(/\s+/).length).toBe(3);
  });

  it("renders a square/rect for piece[0]=2 with stroke 4", () => {
    const { container } = renderPiece(createPiece([2, 0, 2], 3, 3));
    const rect = requireElement(container, "rect");
    expect(rect.getAttribute("stroke")).toBe("red");
    expect(rect.getAttribute("fill")).toBe("purple");
    expect(rect.getAttribute("stroke-width")).toBe("4");
  });

  it("falls back the fill to the stroke color for a 2-dimensional piece", () => {
    const { container } = renderPiece(createPiece([1, 2], 2, 3));
    const polygon = requireElement(container, "polygon");
    expect(polygon.getAttribute("fill")).toBe("mediumseagreen");
    expect(polygon.getAttribute("stroke")).toBe("mediumseagreen");
  });

  it("gives every base-3 piece a visually distinct shape/stroke/fill combination", () => {
    const pieces = allPieces();
    const { container } = render(
      <div>
        {/* eslint-disable-next-line lensflow/require-smart-constructor-validation */}
        {pieces.map((piece) => {
          const state = {
            piece,
            size: 48,
            pieceType: "Shapes",
          } satisfies PieceDisplayState;
          const telescope = Telescope.of<PieceDisplayState>(state);
          return (
            <PieceDisplay
              key={piece.join("·")}
              state={state}
              telescope={telescope}
            />
          );
        })}
      </div>,
    );

    const shapes = container.querySelectorAll("svg");
    expect(shapes.length).toBe(27);
    const labels = new Set(
      Array.from(shapes).map((s) => s.querySelector("title")?.textContent),
    );
    expect(labels.size).toBe(27);

    // Each form occupies exactly 9 of the 27 (3 strokes × 3 fills).
    expect(container.querySelectorAll("circle").length).toBe(9);
    expect(container.querySelectorAll("polygon").length).toBe(9);
    expect(container.querySelectorAll("rect").length).toBe(9);
  });

  it("exposes an accessible name on its svg via its <title>", () => {
    const { container } = renderPiece(createPiece([0, 0, 0], 3, 3));
    const svg = requireElement(container, "svg");
    expect(svg.querySelector("title")?.textContent).toBe(
      "circle, red border, aquamarine fill",
    );
  });
});

describe("PieceDisplay (Faces mode) §5.4", () => {
  it("renders the piece as /faces/h{h}e{e}m{m}.png for its piece[0]/piece[1]/piece[2]", () => {
    const { container } = renderPiece(
      createPiece([0, 1, 2], 3, 3),
      48,
      "Faces",
    );
    const img = requireElement(container, "img");
    expect(img.getAttribute("src")).toBe("/faces/h0e1m2.png");
    expect(img.getAttribute("width")).toBe("48");
    expect(img.getAttribute("height")).toBe("48");
    // No SVG shape in the Faces branch.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("maps every piece digit to the file name exactly (h/e/m order)", () => {
    const { container } = renderPiece(
      createPiece([2, 0, 1], 3, 3),
      32,
      "Faces",
    );
    const img = requireElement(container, "img");
    expect(img.getAttribute("src")).toBe("/faces/h2e0m1.png");
    expect(img.getAttribute("width")).toBe("32");
  });

  it("renders a real face (the grid's first mouth) for a 2-dimensional piece", () => {
    const { container } = renderPiece(createPiece([1, 2], 2, 3), 48, "Faces");
    const img = requireElement(container, "img");
    expect(img.getAttribute("src")).toBe("/faces/h1e2m0.png");
  });

  it("gives every base-3 piece a distinct face image among the 27 seeded assets", () => {
    const pieces = allPieces();
    const { container } = render(
      <div>
        {/* eslint-disable-next-line lensflow/require-smart-constructor-validation */}
        {pieces.map((piece) => {
          const state = {
            piece,
            size: 48,
            pieceType: "Faces",
          } satisfies PieceDisplayState;
          const telescope = Telescope.of<PieceDisplayState>(state);
          return (
            <PieceDisplay
              key={piece.join("·")}
              state={state}
              telescope={telescope}
            />
          );
        })}
      </div>,
    );

    const images = container.querySelectorAll("img");
    expect(images.length).toBe(27);
    // All 27 srcs are distinct, and every one of them is one of the 27 seeded
    // `public/faces/*.png` names (no 404 by construction).
    const srcs = new Set(
      Array.from(images).map((img) => img.getAttribute("src")),
    );
    expect(srcs.size).toBe(27);
    for (const src of srcs) {
      expect(src).toMatch(/^\/faces\/h[0-2]e[0-2]m[0-2]\.png$/);
    }
  });

  it("exposes an accessible name on its img via its alt", () => {
    const { container } = renderPiece(
      createPiece([0, 0, 0], 3, 3),
      48,
      "Faces",
    );
    const img = requireElement(container, "img");
    expect(img.getAttribute("alt")).toBe("face, hair 0, eyes 0, mouth 0");
  });
});
