import { describe, expect, it } from "vitest";
import { createPiece, type Piece } from "../../../game/entities";
import {
  CIRCLE_RADIUS,
  fillColor,
  formOf,
  pieceForm,
  strokeColor,
  trianglePoints,
} from "../pieceShapeTables";

// §7.5 testing pyramid: pure-functions tier — the highest priority, fast, and rendering-
// free. These lock the §5.3 lookup tables to their exact form/stroke-color/fill-color
// values and the 2-d fill fallback.

describe("pieceShapeTables (§5.3 pieces)", () => {
  it("piece[0] selects the form (0=circle, 1=triangle, 2=square)", () => {
    expect(pieceForm(createPiece([0, 1, 2], 3, 3))).toBe("circle");
    expect(pieceForm(createPiece([1, 1, 2], 3, 3))).toBe("triangle");
    expect(pieceForm(createPiece([2, 1, 2], 3, 3))).toBe("square");
  });

  it("piece[1] selects the stroke (border) color", () => {
    expect(strokeColor(createPiece([0, 0, 2], 3, 3))).toBe("red");
    expect(strokeColor(createPiece([0, 1, 2], 3, 3))).toBe("dodgerblue");
    expect(strokeColor(createPiece([0, 2, 2], 3, 3))).toBe("mediumseagreen");
  });

  it("piece[2] selects the fill color for 3-dimensional pieces", () => {
    expect(fillColor(createPiece([0, 1, 0], 3, 3))).toBe("aquamarine");
    expect(fillColor(createPiece([0, 1, 1], 3, 3))).toBe("yellow");
    expect(fillColor(createPiece([0, 1, 2], 3, 3))).toBe("purple");
  });

  it("a 2-dimensional piece's fill falls back to its stroke color", () => {
    // piece = [form, stroke], no third attribute.
    const red = createPiece([0, 0], 2, 3);
    const green = createPiece([2, 2], 2, 3);
    expect(fillColor(red)).toBe(strokeColor(red));
    expect(fillColor(green)).toBe(strokeColor(green));
    expect(fillColor(green)).toBe("mediumseagreen");
  });

  it("the stroke width is a property of the form (circle 5, triangle 4, square 10)", () => {
    expect(formOf(createPiece([0, 0, 0], 3, 3)).strokeWidth).toBe(5);
    expect(formOf(createPiece([1, 0, 0], 3, 3)).strokeWidth).toBe(4);
    expect(formOf(createPiece([2, 0, 0], 3, 3)).strokeWidth).toBe(10);
  });

  it("exposes the §5.3 circle radius", () => {
    expect(CIRCLE_RADIUS).toBe(15);
  });

  it("is a pure function of the piece value: equal values render identically", () => {
    // Two independently-constructed pieces with the same digits.
    const a = createPiece([2, 1, 0], 3, 3);
    const b = createPiece([2, 1, 0], 3, 3);
    expect([pieceForm(a), strokeColor(a), fillColor(a)]).toEqual([
      pieceForm(b),
      strokeColor(b),
      fillColor(b),
    ]);
    // And the same piece queried repeatedly is stable (no hidden state / randomness).
    expect(strokeColor(a)).toBe(strokeColor(a));
    expect(fillColor(a)).toBe(fillColor(a));
  });

  it("maps every base-3, dimension-3 piece to a distinct shape/stroke/fill triple", () => {
    const seen = new Set<string>();
    for (const form of [0, 1, 2]) {
      for (const stroke of [0, 1, 2]) {
        for (const fill of [0, 1, 2]) {
          const piece = createPiece([form, stroke, fill], 3, 3);
          seen.add(
            `${pieceForm(piece)}|${strokeColor(piece)}|${fillColor(piece)}`,
          );
        }
      }
    }
    expect(seen.size).toBe(27);
  });

  it("clamps out-of-range digits to the last table entry instead of yielding undefined", () => {
    // §5.3 only defines base-3 digits; a raw (un-validated) piece simulates a larger base.
    const oversized: Piece = [9, 9, 9];
    expect(pieceForm(oversized)).toBe("square");
    expect(strokeColor(oversized)).toBe("mediumseagreen");
    expect(fillColor(oversized)).toBe("purple");
    const underflow: Piece = [-1, -1];
    expect(pieceForm(underflow)).toBe("circle");
    expect(strokeColor(underflow)).toBe("red");
  });

  it("trianglePoints yields three in-viewBox vertices with the top on the vertical axis", () => {
    const points = trianglePoints()
      .trim()
      .split(/\s+/)
      .map((p) => p.split(",").map(Number));
    expect(points.length).toBe(3);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(40);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(40);
    }
    // Top vertex sits on the viewBox center x, above the center y.
    const [topX, topY] = points[0];
    expect(topX).toBeCloseTo(20, 3);
    expect(topY).toBeLessThan(20);
  });
});
