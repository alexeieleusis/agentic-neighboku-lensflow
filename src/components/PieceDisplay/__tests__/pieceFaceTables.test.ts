import { describe, expect, it } from "vitest";
import { createPiece, type Piece } from "../../../game/entities";
import {
  FACE_ASSET_DIR,
  faceEyes,
  faceHair,
  faceImagePathFor,
  faceLabelFor,
  faceMouth,
} from "../pieceFaceTables";

// §7.5 testing pyramid: pure-functions tier — the highest priority, fast, and rendering-
// free. These lock the §5.4 piece → `/faces/h{h}e{e}m{m}.png` mapping to the exact
// file names of the 27 pre-seeded `public/faces/*.png` assets, plus the 2-d mouth
// fallback and the digit-clamping/missing-digit conventions.

describe("pieceFaceTables (§5.4 pieces)", () => {
  it("piece[0]/piece[1]/piece[2] select the hair/eye/mouth digits (h/e/m)", () => {
    const piece = createPiece([0, 1, 2], 3, 3);
    expect(faceHair(piece)).toBe(0);
    expect(faceEyes(piece)).toBe(1);
    expect(faceMouth(piece)).toBe(2);
    const other = createPiece([2, 0, 1], 3, 3);
    expect(faceHair(other)).toBe(2);
    expect(faceEyes(other)).toBe(0);
    expect(faceMouth(other)).toBe(1);
  });

  it("maps a piece to /faces/h{h}e{e}m{m}.png with the digits in h/e/m order", () => {
    expect(faceImagePathFor(createPiece([0, 1, 2], 3, 3))).toBe(
      "/faces/h0e1m2.png",
    );
    expect(faceImagePathFor(createPiece([1, 0, 0], 3, 3))).toBe(
      "/faces/h1e0m0.png",
    );
    expect(faceImagePathFor(createPiece([2, 2, 1], 3, 3))).toBe(
      "/faces/h2e2m1.png",
    );
  });

  it("the asset directory is the seeded public/faces directory", () => {
    expect(FACE_ASSET_DIR).toBe("/faces");
  });

  it("every base-3, dimension-3 piece maps to one of the 27 seeded face file names", () => {
    const seen = new Set<string>();
    for (const h of [0, 1, 2]) {
      for (const e of [0, 1, 2]) {
        for (const m of [0, 1, 2]) {
          const piece = createPiece([h, e, m], 3, 3);
          seen.add(faceImagePathFor(piece));
        }
      }
    }
    expect(seen.size).toBe(27);
    for (const src of seen) {
      expect(src).toMatch(/^\/faces\/h[0-2]e[0-2]m[0-2]\.png$/);
    }
  });

  it("a 2-dimensional piece's mouth digit falls back to the grid's first mouth (0)", () => {
    // piece = [hair, eyes], no third attribute: §5.4 defines no 2-d fallback image,
    // so the piece renders the grid's first mouth rather than a missing file.
    const twoDimensional = createPiece([1, 2], 2, 3);
    expect(faceMouth(twoDimensional)).toBe(0);
    expect(faceImagePathFor(twoDimensional)).toBe("/faces/h1e2m0.png");
    // Present digits still resolve as before.
    expect(faceHair(twoDimensional)).toBe(1);
    expect(faceEyes(twoDimensional)).toBe(2);
  });

  it("is a pure function of the piece value: equal values map identically", () => {
    // Two independently-constructed pieces with the same digits.
    const a = createPiece([2, 1, 0], 3, 3);
    const b = createPiece([2, 1, 0], 3, 3);
    expect(faceImagePathFor(a)).toBe(faceImagePathFor(b));
    expect(faceLabelFor(a)).toBe(faceLabelFor(b));
    // And the same piece queried repeatedly is stable (no hidden state / randomness).
    expect(faceImagePathFor(a)).toBe(faceImagePathFor(a));
  });

  it("yields the face's accessible label in the video's attribute order", () => {
    expect(faceLabelFor(createPiece([0, 1, 2], 3, 3))).toBe(
      "face, hair 0, eyes 1, mouth 2",
    );
  });

  it("throws the domain RangeError when a required attribute digit is missing (short piece)", () => {
    // `createPiece` admits shorter pieces (dimension 1 / 0); the §5.4 display
    // accessors need more digits than such a piece carries, so they fail fast
    // with the same `RangeError` `createPiece` throws instead of leaking
    // `NaN`/`undefined` into a face file name and the render.
    const oneDimensional: Piece = createPiece([1], 1, 3); // has piece[0], lacks piece[1]
    const empty: Piece = createPiece([], 0, 3); // lacks piece[0] and piece[1]
    expect(() => faceEyes(oneDimensional)).toThrow(RangeError);
    expect(() => faceImagePathFor(oneDimensional)).toThrow(RangeError);
    expect(() => faceLabelFor(oneDimensional)).toThrow(RangeError);
    expect(() => faceHair(empty)).toThrow(RangeError);
    expect(() => faceEyes(empty)).toThrow(RangeError);
    expect(() => faceImagePathFor(empty)).toThrow(RangeError);
    // Present digits still resolve as before: a 1-d piece's hair digit is intact.
    expect(faceHair(oneDimensional)).toBe(1);
  });

  it("clamps out-of-range digits into the face grid instead of yielding a missing file", () => {
    // §5.4's face grid only defines base-3 digits; a raw (un-validated) piece
    // simulates a larger base. The result must stay one of the 27 seeded names.
    const oversized: Piece = [9, 9, 9];
    expect(faceHair(oversized)).toBe(2);
    expect(faceEyes(oversized)).toBe(2);
    expect(faceMouth(oversized)).toBe(2);
    expect(faceImagePathFor(oversized)).toBe("/faces/h2e2m2.png");
    const underflow: Piece = [-1, -1];
    expect(faceHair(underflow)).toBe(0);
    expect(faceEyes(underflow)).toBe(0);
    expect(faceMouth(underflow)).toBe(0);
    expect(faceImagePathFor(underflow)).toBe("/faces/h0e0m0.png");
  });
});
