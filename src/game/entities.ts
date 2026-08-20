export type Piece = ReadonlyArray<number>;

export function createPiece(
  values: readonly number[],
  dimension: number,
  base: number,
): Piece {
  if (values.length !== dimension) {
    throw new RangeError(
      `Piece must have exactly ${dimension} attributes, got ${values.length}`,
    );
  }
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isInteger(v) || v < 0 || v >= base) {
      throw new RangeError(
        `Attribute value ${String(v)} at position ${i} out of range [0, ${base})`,
      );
    }
  }
  return Object.freeze(values.slice());
}

export function isSamePiece(a: Piece, b: Piece): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
