import type { Piece } from "../../game/entities";
import type { Tray } from "../../game/gameBuilder";

/**
 * §5.5 — the pure tier of this component's fractal split (requirements §7.2.1): no
 * React, no telescope imports. Highest-priority tier of the testing pyramid
 * (requirements §7.5) — see __tests__/useAvailablePiecesTrayDomain.test.ts.
 */

/**
 * Pixel edge a tray column renders its piece image at via the shared Phase 6
 * `PieceDisplay`. A layout choice of the rebuild: the tray row spans the board's
 * width and wraps when the next column would not fit, so no size-derived total
 * width is needed.
 */
export const TRAY_PIECE_IMAGE_PX = 48;

/**
 * A piece's base-10-encoded value (§5.5's sort key): its attribute digits read as
 * decimal digits, most significant first (`[0,2,0]` → 20, `[1,0,0]` → 100). Every
 * supported preference has `base` ≤ 10, so each digit is < 10.
 *
 * The encoding is order-preserving only *within a single attribute length*: it is
 * injective among same-length pieces, so it orders the tray columns exactly the way
 * the tutorial video's left-to-right ordering does — but across lengths it can
 * collide (`[2]` and `[0,2]` both encode to 2) or misorder (`[2]` → 2 sorts before
 * `[1,0]` → 10 despite its larger leading digit). No production tray ever mixes
 * lengths — every piece on a board (and in the tray unfolded from it) comes from one
 * `base^dimension` pool — so {@link sortedRemainingPieces} asserts that before
 * sorting rather than trusting the caller.
 */
export function pieceBase10Value(piece: Piece): number {
  return piece.reduce((encoded, digit) => encoded * 10 + digit, 0);
}

/**
 * §5.5 first bullet: the distinct piece values with at least one copy remaining,
 * ascending by base-10-encoded value. Zero-count values are excluded so a
 * fully-placed value never gets a column even if its entry has not been dropped from
 * the map yet (the move engine drops entries at zero — §3.5 step 3 — but the tray
 * must not rely on that to stay correct). The input tray is not mutated: the result
 * is a fresh, sorted array.
 *
 * The base-10 sort key is only order-preserving when every remaining piece shares
 * one attribute length (see {@link pieceBase10Value}), so that is asserted here: a
 * mixed-length tray turns from a silent mis-order into a loud contract violation.
 */
export function sortedRemainingPieces(tray: Tray): readonly Piece[] {
  const remaining: Piece[] = [];
  for (const [piece, count] of tray) {
    if (count > 0) remaining.push(piece);
  }
  assertSingleAttributeLength(remaining);
  return remaining.sort((a, b) => pieceBase10Value(a) - pieceBase10Value(b));
}

/**
 * Guard for {@link sortedRemainingPieces}: the base-10 sort key is
 * order-preserving only within one attribute length, so the remaining pieces must
 * all have the same length. Zero-count pieces are already excluded — a fully-placed
 * value cannot misorder the columns that remain. Matches the codebase's `RangeError`
 * convention for dimension mismatches (`createPiece`, `sharedAttributeCount`).
 */
function assertSingleAttributeLength(remaining: readonly Piece[]): void {
  if (remaining.length === 0) return;
  const dimension = remaining[0].length;
  for (let i = 1; i < remaining.length; i++) {
    const piece = remaining[i];
    if (piece.length !== dimension) {
      throw new RangeError(
        `sortedRemainingPieces: tray pieces must share one attribute dimension, ` +
          `got ${dimension} and ${piece.length}`,
      );
    }
  }
}

/**
 * §5.5 second bullet: the remaining count for one distinct piece value. Reads straight
 * from the move engine's `availablePieces`, so it always matches the tray state
 * exactly — including 0 for a value that is fully placed (absent from the map).
 */
export function trayRemainingCount(tray: Tray, piece: Piece): number {
  return tray.get(piece) ?? 0;
}
