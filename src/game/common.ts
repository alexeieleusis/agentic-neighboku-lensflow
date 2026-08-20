import type { Piece } from "./entities";

export function sharedAttributeCount(a: Piece, b: Piece): number {
  if (a.length !== b.length) {
    throw new RangeError(
      `Pieces must have the same dimension, got ${a.length} and ${b.length}`,
    );
  }
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) {
      count++;
    }
  }
  return count;
}

export function isValidNeighbor(a: Piece, b: Piece): boolean {
  return sharedAttributeCount(a, b) === 1;
}
