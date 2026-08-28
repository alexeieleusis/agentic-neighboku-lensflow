import type { Piece } from "../../game/entities";

/**
 * §5.4 piece-rendering lookup — Faces mode. The component-local pure tier of the
 * fractal split (`requirements.md` §7.2.1): no React, no telescope. A piece's three
 * attribute digits drive the three face attributes the video describes:
 * digit 0 → hair color, digit 1 → eye expression, digit 2 → mouth expression.
 *
 * §5.4 (verbatim): "Piece is rendered as an image `/faces/h{h}e{e}m{m}.png` where
 * `h/e/m` are `piece[0]/piece[1]/piece[2]`." The 27 (`3×3×3`) face PNGs already
 * exist under `public/faces/` (CONVENTIONS.md "Reference assets already seeded
 * here"); this table only maps a piece value onto one of those 27 file names —
 * it never creates, regenerates, or names any asset of its own.
 *
 * The digit handling mirrors `pieceShapeTables.ts`'s conventions: a missing
 * required digit is a domain error (the same `RangeError` `createPiece` throws),
 * and out-of-range digits (a base larger than 3) clamp to the last face-grid
 * entry rather than yield a file name that does not exist.
 */

/** The face-asset directory under `public/`, served from the site root. */
export const FACE_ASSET_DIR = "/faces";

/** The three `3×3×3` face-grid digit values (the file names only ever hold 0/1/2). */
const FACE_GRID_DIGITS = [0, 1, 2] as const;

/* -------------------------------------------------------------------------- */
/* Digit accessors (same conventions as `pieceShapeTables.ts`'s lookups)       */
/* -------------------------------------------------------------------------- */

/** Safe index into a fixed table: negative → first, ≥ length → last. */
function pick<T>(table: readonly T[], index: number): T {
  const i = index < 0 ? 0 : Math.min(index, table.length - 1);
  return table[i];
}

/**
 * Read a required attribute digit `piece[index]`. Throws the same domain
 * `RangeError` `createPiece` throws when the piece has fewer than
 * `index + 1` attributes — a short piece simply lacks the digit instead of
 * carrying a sentinel, so failing fast here is what keeps a missing digit from
 * leaking `NaN`/`undefined` into a face file name and the render.
 */
function requiredDigit(piece: Piece, index: number): number {
  if (piece.length <= index) {
    throw new RangeError(
      `Piece has ${piece.length} attribute(s); attribute ${index} is required but missing`,
    );
  }
  return piece[index];
}

/**
 * `piece[0]` → the hair-color digit, clamped into the face grid. Throws
 * `RangeError` when the piece carries no hair digit (a 0-d piece).
 */
export function faceHair(piece: Piece): number {
  return pick(FACE_GRID_DIGITS, requiredDigit(piece, 0));
}

/**
 * `piece[1]` → the eye-expression digit, clamped into the face grid. Throws
 * `RangeError` when the piece carries no eye digit (a 0-d or 1-d piece).
 */
export function faceEyes(piece: Piece): number {
  return pick(FACE_GRID_DIGITS, requiredDigit(piece, 1));
}

/**
 * `piece[2]` → the mouth-expression digit, clamped into the face grid. §5.4
 * defines no 2-d fallback (the face image replaces the shape entirely, so there
 * is no stroke color to fall back to); a piece with no third attribute takes
 * the grid's first mouth (`0`), mirroring §5.3's documented 2-d fill fallback
 * in `pieceShapeTables.ts` rather than throwing: the shipped configuration is
 * dimension 3 (§8.5 forces it on load), so this only matters for a
 * 2-attribute space, where every piece still renders a real face instead of a
 * crash.
 */
export function faceMouth(piece: Piece): number {
  return pick(FACE_GRID_DIGITS, piece.length > 2 ? piece[2] : 0);
}

/* -------------------------------------------------------------------------- */
/* The §5.4 piece → image mapping + the accessible label                       */
/* -------------------------------------------------------------------------- */

/**
 * §5.4: `piece` → `/faces/h{h}e{e}m{m}.png`, where `h/e/m` are
 * `piece[0]/piece[1]/piece[2]` (hair color / eye expression / mouth
 * expression). Pure and total over every piece value the app can hold: the
 * result is always one of the 27 pre-seeded file names, so a Faces-mode render
 * can never 404.
 */
export function faceImagePathFor(piece: Piece): string {
  const h = faceHair(piece);
  const e = faceEyes(piece);
  const m = faceMouth(piece);
  return `${FACE_ASSET_DIR}/h${h}e${e}m${m}.png`;
}

/**
 * The face's accessible name, in the video's attribute order (the §5.4
 * "hair color, eye expression, mouth expression" description) — the `<img>`'s
 * `alt`, the Faces-mode counterpart of the Shapes SVG's `<title>`.
 */
export function faceLabelFor(piece: Piece): string {
  return `face, hair ${faceHair(piece)}, eyes ${faceEyes(piece)}, mouth ${faceMouth(piece)}`;
}
