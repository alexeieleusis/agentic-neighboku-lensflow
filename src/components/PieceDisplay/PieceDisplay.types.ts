import type { Piece } from "../../game/entities";
import type { PieceForm } from "./pieceShapeTables";

/**
 * The complete, self-describing state slice for one rendered piece (§5.3): the piece value
 * plus the rendered pixel edge (`size`) the shared component is asked to draw at. `size`
 * is part of state (rather than a bare prop) so a parent can control display scale by
 * writing through its magnified telescope, exactly like the other fractal components here.
 */
export interface PieceDisplayState {
  readonly piece: Piece;
  /** Rendered edge of the SVG box, in px (the internal `PIECE_VIEWBOX` maps onto this). */
  readonly size: number;
}

/**
 * Everything `RenderPieceDisplay` needs, precomputed by `usePieceDisplayViewModel`. The
 * three §5.3 visual attributes (form / stroke color / fill color) plus that form's stroke
 * width, the requested `size`, and an accessible label. Rendering stays a pure function
 * of the piece value: no local state, no randomness.
 */
export interface PieceDisplayViewModel {
  readonly form: PieceForm;
  readonly strokeColor: string;
  readonly fillColor: string;
  readonly strokeWidth: number;
  readonly size: number;
  /** Human-readable description used as the SVG's `aria-label`. */
  readonly ariaLabel: string;
}