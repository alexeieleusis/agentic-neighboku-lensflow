export type Piece = ReadonlyArray<number>;

/**
 * The two visual skins for the shared attribute space (requirements §1, §5.4). A
 * shell-wide §4.2 preference, not a concern of any single display component, so it
 * lives in the shared game-domain layer (this module) rather than in a component's
 * types file: both display components that render pieces (`CellDisplay`,
 * `PieceDisplay`) import it from here bottom-up, which keeps the component type
 * graph acyclic. `PIECE_TYPES` is the runtime constant of the accepted skin values
 * and `PieceType` is the explicit string-literal union mirroring it; adding a skin
 * now requires editing both declarations, so a lint rule or test asserting that
 * `PIECE_TYPES` members match `PieceType` can keep them from drifting apart.
 */
export const PIECE_TYPES = ["Shapes", "Faces"] as const;
export type PieceType = "Shapes" | "Faces";

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
