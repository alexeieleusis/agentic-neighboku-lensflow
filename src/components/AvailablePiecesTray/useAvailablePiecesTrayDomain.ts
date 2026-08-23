import type { Piece } from "../../game/entities";
import type { Tray } from "../../game/gameBuilder";

/**
 * §5.5 — the pure tier of this component's fractal split (requirements §7.2.1): no
 * React, no telescope imports. Highest-priority tier of the testing pyramid
 * (requirements §7.5) — see __tests__/useAvailablePiecesTrayDomain.test.ts.
 */

/** §5.5: for a `size × size` board the tray is `56px × size` wide in total. */
export const TRAY_WIDTH_PER_SIZE_PX = 56;

/**
 * Pixel edge a tray column renders its piece image at via the shared Phase 6
 * `PieceDisplay`. §5.5 fixes only the total tray width, so this is a layout choice of
 * the rebuild, kept here with the other tray layout constants.
 */
export const TRAY_PIECE_IMAGE_PX = 48;

/**
 * A piece's base-10-encoded value (§5.5's sort key): its attribute digits read as
 * decimal digits, most significant first (`[0,2,0]` → 20, `[1,0,0]` → 100). Every
 * supported preference has `base` ≤ 10, so each digit is < 10 and this encoding is
 * order-preserving in the digits: it sorts the tray columns exactly the way the
 * tutorial video's left-to-right ordering does.
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
 */
export function sortedRemainingPieces(tray: Tray): readonly Piece[] {
  const remaining: Piece[] = [];
  for (const [piece, count] of tray) {
    if (count > 0) remaining.push(piece);
  }
  return remaining.sort((a, b) => pieceBase10Value(a) - pieceBase10Value(b));
}

/**
 * §5.5 second bullet: the remaining count for one distinct piece value. Reads straight
 * from the move engine's `availablePieces`, so it always matches the tray state
 * exactly — including 0 for a value that is fully placed (absent from the map).
 */
export function trayRemainingCount(tray: Tray, piece: Piece): number {
  return tray.get(piece) ?? 0;
}

/** §5.5: `56px × size`, in px. */
export function trayWidthPx(size: number): number {
  return TRAY_WIDTH_PER_SIZE_PX * size;
}
