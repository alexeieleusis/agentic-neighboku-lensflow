import { describe, it, expect } from "vitest";
import { createPiece, isSamePiece } from "../entities";
import type { Piece } from "../entities";

describe("createPiece", () => {
  it("creates a valid piece", () => {
    const piece: Piece = createPiece([0, 1, 2], 3, 3);
    expect(piece).toEqual([0, 1, 2]);
    expect(piece.length).toBe(3);
  });

  it("creates a piece with base values at the upper boundary", () => {
    const piece = createPiece([2, 2, 2], 3, 3);
    expect(piece).toEqual([2, 2, 2]);
  });

  it("throws on wrong dimension length", () => {
    expect(() => createPiece([0, 1], 3, 3)).toThrow(RangeError);
    expect(() => createPiece([0, 1, 2, 3], 3, 3)).toThrow(RangeError);
  });

  it("throws on value below 0", () => {
    expect(() => createPiece([-1, 1, 2], 3, 3)).toThrow(RangeError);
  });

  it("throws on value at or above base", () => {
    expect(() => createPiece([0, 1, 3], 3, 3)).toThrow(RangeError);
    expect(() => createPiece([0, 1, 5], 3, 3)).toThrow(RangeError);
  });

  it("throws on non-integer value", () => {
    expect(() => createPiece([0, 1.5, 2], 3, 3)).toThrow(RangeError);
  });

  it("returns a frozen array", () => {
    const piece = createPiece([0, 1, 2], 3, 3);
    expect(Object.isFrozen(piece)).toBe(true);
  });

  it("does not alias the input array", () => {
    const input = [0, 1, 2];
    const piece = createPiece(input, 3, 3);
    input.push(3);
    expect(piece.length).toBe(3);
  });

  it("works with a custom dimension and base", () => {
    const piece = createPiece([0, 3], 2, 4);
    expect(piece).toEqual([0, 3]);
  });
});

describe("isSamePiece", () => {
  it("returns true for the same reference", () => {
    const piece = createPiece([0, 1, 2], 3, 3);
    expect(isSamePiece(piece, piece)).toBe(true);
  });

  it("returns true for distinct pieces with equal values", () => {
    const a = createPiece([0, 1, 2], 3, 3);
    const b = createPiece([0, 1, 2], 3, 3);
    expect(isSamePiece(a, b)).toBe(true);
  });

  it("returns false for pieces with different values", () => {
    const a = createPiece([0, 1, 2], 3, 4);
    const b = createPiece([0, 1, 3], 3, 4);
    expect(isSamePiece(a, b)).toBe(false);
  });
});
