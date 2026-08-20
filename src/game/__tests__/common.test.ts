import { describe, it, expect } from 'vitest';
import { createPiece } from '../entities';
import { sharedAttributeCount, isValidNeighbor } from '../common';

describe('sharedAttributeCount', () => {
  it('returns 0 when no positions match', () => {
    const a = createPiece([0, 1, 2], 3, 3);
    const b = createPiece([1, 2, 0], 3, 3);
    expect(sharedAttributeCount(a, b)).toBe(0);
  });

  it('returns 1 when exactly one position matches', () => {
    const a = createPiece([0, 1, 2], 3, 3);
    const b = createPiece([0, 2, 1], 3, 3);
    expect(sharedAttributeCount(a, b)).toBe(1);
  });

  it('returns 2 when two positions match', () => {
    const a = createPiece([0, 1, 2], 3, 3);
    const b = createPiece([0, 1, 0], 3, 3);
    expect(sharedAttributeCount(a, b)).toBe(2);
  });

  it('returns dimension when all positions match', () => {
    const a = createPiece([0, 1, 2], 3, 3);
    const b = createPiece([0, 1, 2], 3, 3);
    expect(sharedAttributeCount(a, b)).toBe(3);
  });

  it('throws when pieces have different dimensions', () => {
    const a = createPiece([0, 1], 2, 3);
    const b = createPiece([0, 1, 2], 3, 3);
    expect(() => sharedAttributeCount(a, b)).toThrow(RangeError);
  });
});

describe('isValidNeighbor', () => {
  it('returns true when exactly one attribute position matches', () => {
    const a = createPiece([0, 1, 2], 3, 3);
    const b = createPiece([0, 2, 1], 3, 3);
    expect(isValidNeighbor(a, b)).toBe(true);
  });

  it('returns false when zero attribute positions match', () => {
    const a = createPiece([0, 1, 2], 3, 3);
    const b = createPiece([1, 2, 0], 3, 3);
    expect(isValidNeighbor(a, b)).toBe(false);
  });

  it('returns false when two attribute positions match', () => {
    const a = createPiece([0, 1, 2], 3, 3);
    const b = createPiece([0, 1, 0], 3, 3);
    expect(isValidNeighbor(a, b)).toBe(false);
  });

  it('returns false when all attribute positions match', () => {
    const a = createPiece([0, 1, 2], 3, 3);
    const b = createPiece([0, 1, 2], 3, 3);
    expect(isValidNeighbor(a, b)).toBe(false);
  });

  it('is symmetric', () => {
    const pieceA = createPiece([0, 1, 2], 3, 3);
    const pieceB = createPiece([0, 2, 1], 3, 3);
    expect(isValidNeighbor(pieceA, pieceB)).toBe(isValidNeighbor(pieceB, pieceA));
  });
});
