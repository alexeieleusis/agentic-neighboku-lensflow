import type { Piece } from "../../game/entities";

/**
 * §5.3 piece-rendering lookup tables — Shapes mode. The component-local pure tier of the
 * fractal split (`requirements.md` §7.2.1): no React, no telescope. A piece's three
 * attribute digits drive the three visual attributes the neighbor rule operates on:
 * digit 0 → form, digit 1 → stroke (border) color, digit 2 → fill color.
 *
 * §5.3 (verbatim):
 * - `piece[0]`: 0 = Circle (r=15, stroke 5), 1 = Equilateral triangle (stroke 4),
 *   2 = Square/rect (stroke 10).
 * - Stroke color by `piece[1]`: 0 → red, 1 → dodgerblue, 2 → mediumseagreen.
 * - Fill color by `piece[2]` (3-d pieces): 0 → aquamarine, 1 → yellow, 2 → purple;
 *   for 2-dimensional pieces the fill falls back to the stroke color.
 */

/** The three forms §5.3 assigns to `piece[0]` (0 = circle, 1 = triangle, 2 = square). */
export type PieceForm = "circle" | "triangle" | "square";

/** Per-form SVG description: which form to draw and the §5.3 stroke width that form uses. */
export interface ShapeForm {
  readonly form: PieceForm;
  readonly strokeWidth: number;
}

/**
 * `piece[0]` → `ShapeForm` (§5.3). The stroke WIDTH is a property of the form (circle 5,
 * triangle 4, square 10), whereas the stroke *color* is a property of `piece[1]`.
 */
export const FORM_BY_INDEX: readonly ShapeForm[] = [
  Object.freeze({ form: "circle", strokeWidth: 5 }),
  Object.freeze({ form: "triangle", strokeWidth: 4 }),
  Object.freeze({ form: "square", strokeWidth: 10 }),
];

/** `piece[1]` → stroke (border) color, in the order §5.3 names red / dodgerblue / mediumseagreen. */
export const STROKE_COLORS: readonly string[] = [
  "red",
  "dodgerblue",
  "mediumseagreen",
];

/** `piece[2]` → fill color, in the order §5.3 names aquamarine / yellow / purple. */
export const FILL_COLORS: readonly string[] = [
  "aquamarine",
  "yellow",
  "purple",
];

/* -------------------------------------------------------------------------- */
/* Lookup accessors (total: §5.3 only defines base-3 digits, so out-of-range   */
/* digits clamp to the last entry rather than yield `undefined`).              */
/* -------------------------------------------------------------------------- */

/** Safe index into a fixed table: negative → first, ≥ length → last. */
function pick<T>(table: readonly T[], index: number): T {
  const i = index < 0 ? 0 : Math.min(index, table.length - 1);
  return table[i];
}

/** `piece[0]` → the form + §5.3 stroke width for that form. */
export function formOf(piece: Piece): ShapeForm {
  return pick(FORM_BY_INDEX, piece[0]);
}

/** `piece[0]` → just the form name. */
export function pieceForm(piece: Piece): PieceForm {
  return formOf(piece).form;
}

/** `piece[1]` → stroke (border) color. */
export function strokeColor(piece: Piece): string {
  return pick(STROKE_COLORS, piece[1]);
}

/**
 * `piece[2]` → fill color. §5.3's 2-d fallback: a piece with no third digit
 * (`piece[2] === undefined`) fills with its stroke color.
 */
export function fillColor(piece: Piece): string {
  return piece.length > 2 ? pick(FILL_COLORS, piece[2]) : strokeColor(piece);
}

/* -------------------------------------------------------------------------- */
/* Internal SVG geometry (a shared `viewBox` keeps form + size decoupled)     */
/* -------------------------------------------------------------------------- */

/**
 * The internal coordinate space every form is drawn in. `RenderPieceDisplay` maps this
 * onto `size` px via the SVG `viewBox`, so the internal numbers below are independent
 * of any rendered pixel size.
 */
export const PIECE_VIEWBOX = 40;
/** The center of {@linkcode PIECE_VIEWBOX}; every form is drawn around this point. */
export const PIECE_CENTER = PIECE_VIEWBOX / 2;
/** §5.3 circle radius. */
export const CIRCLE_RADIUS = 15;
/** Circumradius (§5.3 does not fix it) of the §5.3 equilateral triangle. */
export const TRI_CIRCUMRADIUS = 14;
/** Half-side of the §5.3 square (drawn centered in the viewBox). */
export const SQUARE_HALF_SIDE = 10;

/**
 * The `points` attribute for §5.3's equilateral triangle, point-up, centered on
 * {@linkcode PIECE_CENTER} and inscribed in a circle of {@linkcode TRI_CIRCUMRADIUS}.
 * Pure/total: computes the three vertex `(x,y)` pairs on the circumcircle at
 * 90°/210°/330° (SVG y-down ⇒ the triangle points up) and joins them to a `points` string.
 */
export function trianglePoints(): string {
  const r = TRI_CIRCUMRADIUS;
  const c = PIECE_CENTER;
  const halfWidth = (Math.sqrt(3) / 2) * r;
  const bottomY = c + r / 2;
  return (
    `${c},${round3(c - r)} ` +
    `${round3(c - halfWidth)},${round3(bottomY)} ` +
    `${round3(c + halfWidth)},${round3(bottomY)}`
  );
}

/** Round to 3 places and strip trailing zeros for a short, stable SVG `points` value. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}