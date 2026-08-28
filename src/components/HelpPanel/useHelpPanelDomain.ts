import type { Piece } from "../../game/entities";
import { isSamePiece } from "../../game/entities";
import {
  buildPiecePool,
  buildPossibleNeighbors,
} from "../../game/boardBuilder.ts";

/**
 * §5.10 (Phase 18) — the pure tier of this panel's fractal split (requirements
 * §7.2.1): no React, no telescope imports. Highest-priority tier of the testing
 * pyramid (requirements §7.5) — see `__tests__/useHelpPanelDomain.test.ts`.
 *
 * Owns the two neighbor-set derivations (§5.10 items 2/3) and the static link
 * data (§5.10 items 4–6). It reuses Phase 2's `buildPiecePool` (the full
 * candidate space) and `buildPossibleNeighbors` (the valid-neighbor set, no
 * exclusions) verbatim — it calls those already-unit-tested domain functions
 * and reimplements none of the neighbor rule itself.
 */

/**
 * Pixel edge the shared Phase 6 `PieceDisplay` renders each piece at inside this
 * panel (the selector's options + the two neighbor groups). A rebuild layout
 * choice; the tray's equivalent is `TRAY_PIECE_IMAGE_PX`, the cell tooltip's
 * `FIT_PIECE_IMAGE_PX`.
 */
export const HELP_PIECE_IMAGE_PX = 32;

/** §5.10 item 1: the closed selector's no-selection display. */
export const NO_SELECTION_LABEL = "Select a piece";

/* -------------------------------------------------------------------------- */
/* §5.10 items 4–6: the static link data                                       */
/* -------------------------------------------------------------------------- */

/** §5.10 item 4: the English tutorial video's target + label. */
export const ENGLISH_TUTORIAL_VIDEO_URL = "https://youtu.be/bNur5zjGsSk";
export const ENGLISH_TUTORIAL_VIDEO_LABEL = "Tutorial in English";

/** §5.10 item 5: the Spanish tutorial video's target + label. */
export const SPANISH_TUTORIAL_VIDEO_URL = "https://youtu.be/Z3SGoIoxOlA";
export const SPANISH_TUTORIAL_VIDEO_LABEL = "Tutorial en Español";

/**
 * §5.10 item 6 / §5.4: the Freepik face-image credit. A static attribution,
 * rendered unconditionally by this panel regardless of the current `pieceType`
 * (the panel's state slice does not even carry `pieceType` — the link's
 * presence cannot depend on it by construction).
 */
export const FREPIK_ATTRIBUTION_URL =
  "https://www.freepik.com/free-vector/young-people-expressions-with-different-faces_1250793.htm";
export const FREPIK_ATTRIBUTION_LABEL = "Images under license by Freep!k";

/* -------------------------------------------------------------------------- */
/* §5.10 items 1–3: candidate space + the two neighbor sets                    */
/* -------------------------------------------------------------------------- */

/**
 * §5.10 item 1: the full candidate space — every `base^dimension` distinct
 * piece value, Phase 2's interned pool in pool order (base-`base` digit order,
 * most significant attribute first: `[0,0,0]`, `[0,0,1]`, …). The same pool
 * every board of this `base`/`dimension` is built from.
 */
export function candidateSpaceFor(
  dimension: number,
  base: number,
): readonly Piece[] {
  return buildPiecePool(dimension, base);
}

/**
 * §5.10 item 2: the valid-neighbor set of `piece` — Phase 2's
 * `buildPossibleNeighbors` with no exclusions, called as-is: the pieces that
 * share exactly one attribute position with `piece` (§3.2's exact neighbor
 * rule), never `piece` itself. This phase reuses that function; it does not
 * recompute or duplicate the rule anywhere in the panel.
 *
 * §8.7 (replicated, flagged for human review): the one value-level correction
 * on top of the call: `buildPossibleNeighbors` self-excludes by REFERENCE
 * (`candidate !== piece` — the interned pool's own copy of `piece`'s value).
 * That is inertly correct for a pool-referenced piece, and for any piece at
 * dimension ≥ 2 (`isValidNeighbor` is false for a piece against itself there,
 * since it shares all its positions, not exactly one) — but a NON-pool
 * reference at 1 dimension would slip through, because `[0]` shares exactly
 * one position with itself. The panel's "valid neighbors of the selected
 * piece" is by definition never the piece itself, so the result is filtered
 * by value; this changes nothing at the shipped configurations (dimension
 * 2–3) and keeps the set correct for any input.
 *
 * §8.1 (replicated, flagged for human review): `buildPossibleNeighbors` —
 * like the move engine's `findNeighbors`/`findExclusions` — implements the
 * code's orthogonal-only behavior. The original doc/video describe the
 * neighbor rule as including diagonal cells; that wording discrepancy is
 * deliberately left open here (see the flag above the neighbor groupings in
 * `HelpPanel.tsx`), while the behavior is fixed: orthogonal-only, exactly as
 * the shipped game.
 */
export function validNeighborSetFor(
  piece: Piece,
  base: number,
): readonly Piece[] {
  return buildPossibleNeighbors(piece, base).filter(
    (member) => !isSamePiece(member, piece),
  );
}

/**
 * §5.10 item 3: the invalid-neighbor set — the full candidate space minus the
 * valid set. By construction the two sets partition the candidate space: the
 * valid set is a subset of it (both draw on the `base^dimension` pool), and the
 * invalid set is the set difference, so every candidate piece appears in
 * exactly one of the two sets — no overlap, no omissions. The selected piece
 * itself lands in the invalid set: a piece is never its own valid neighbor.
 *
 * §8.7 (flagged for human review): membership is by VALUE (`isSamePiece`), not
 * by reference identity. `buildPossibleNeighbors` interns its own pool
 * internally (a second `buildPiecePool` call), so its result holds piece
 * references distinct from this panel's candidate space's, even for equal
 * values; a reference `includes` would therefore miscount every piece as
 * invalid. Value comparison across the two pools is the only correct
 * membership test, at O(space × valid-set) — trivially small (≤ 27 × 12 at
 * base 3, dimension 3, the shipped configuration).
 */
export function invalidNeighborSetFor(
  candidateSpace: readonly Piece[],
  validNeighbors: readonly Piece[],
): readonly Piece[] {
  return candidateSpace.filter(
    (candidate) =>
      !validNeighbors.some((valid) => isSamePiece(valid, candidate)),
  );
}

/* -------------------------------------------------------------------------- */
/* Selector value plumbing                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A piece's human-readable digit label — the selector's option text and the
 * closed selector's displayed value: its attribute digits, space-separated
 * (the board placeholder's `pieceLabelFor` convention). Unique within one
 * candidate space: two distinct pool pieces always differ in at least one
 * digit, so no two pieces of one `base^dimension` space share a label.
 */
export function pieceLabel(piece: Piece): string {
  return piece.map(String).join(" ");
}

/**
 * The inverse of {@link pieceLabel} within one candidate space: the member
 * whose digit label is `label`, or `null` for the no-selection value (`""`)
 * and for any label the space does not hold. The piece selector's `onChange`
 * hands the raw option value (a label string) through here, so a value the
 * space cannot explain resolves to "no selection" instead of crashing.
 */
export function resolvePieceByLabel(
  candidateSpace: readonly Piece[],
  label: string,
): Piece | null {
  for (const piece of candidateSpace) {
    if (pieceLabel(piece) === label) return piece;
  }
  return null;
}
