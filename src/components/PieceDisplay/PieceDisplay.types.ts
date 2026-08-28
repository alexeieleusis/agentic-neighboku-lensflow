import type { Piece } from "../../game/entities";
import type { PieceType } from "../CellDisplay/CellDisplay.types.ts";
import type { PieceForm } from "./pieceShapeTables";

/**
 * The complete, self-describing state slice for one rendered piece (§5.3/§5.4): the
 * piece value, the rendered pixel edge (`size`) the shared component is asked to draw
 * at, and the §4.2 `pieceType` preference that selects which of the two renderings —
 * the §5.3 shape or the §5.4 face image — this slice draws. `size`/`pieceType` are
 * part of state (rather than bare props) so a parent can control display scale and
 * skin by writing through its magnified telescope, exactly like the other fractal
 * components here; `pieceType` is what makes the Phase 19 mode switch reach every
 * piece display (board fit-pieces, tray, Help panel) uniformly — each consumer's
 * piece-image slice forwards its slice's `pieceType`, and this component renders
 * both branches, so no consumer carries a second piece-rendering path.
 */
export interface PieceDisplayState {
  readonly piece: Piece;
  /** Rendered edge of the piece box (SVG `viewBox` target in Shapes mode, `img` edge in Faces mode), in px. */
  readonly size: number;
  /** The §4.2 skin preference this piece renders in (§5.3 Shapes / §5.4 Faces). */
  readonly pieceType: PieceType;
}

/**
 * Everything `RenderPieceDisplay` needs for the §5.3 Shapes branch, precomputed by
 * `usePieceDisplayViewModel`: the three §5.3 visual attributes (form / stroke color /
 * fill color) plus that form's stroke width, the requested `size`, and an accessible
 * label.
 */
export interface PieceDisplayShapesViewModel {
  readonly pieceType: "Shapes";
  readonly form: PieceForm;
  readonly strokeColor: string;
  readonly fillColor: string;
  readonly strokeWidth: number;
  readonly size: number;
  /** Human-readable description used as the SVG's `aria-label`/`<title>`. */
  readonly ariaLabel: string;
}

/**
 * Everything `RenderPieceDisplay` needs for the §5.4 Faces branch, precomputed by
 * `usePieceDisplayViewModel`: the piece's face image path (one of the 27 pre-seeded
 * `public/faces/*.png` names, `pieceFaceTables.ts`), the requested `size`, and the
 * face's accessible label.
 */
export interface PieceDisplayFacesViewModel {
  readonly pieceType: "Faces";
  /** `/faces/h{h}e{e}m{m}.png` for this piece's `piece[0]/piece[1]/piece[2]` (§5.4). */
  readonly faceImagePath: string;
  readonly size: number;
  /** Human-readable description used as the `<img>`'s `alt`. */
  readonly ariaLabel: string;
}

/**
 * The view model `RenderPieceDisplay` consumes: one branch per §4.2 skin, discriminated
 * by `pieceType` — the §5.3 shape attributes or the §5.4 face image. Rendering stays a
 * pure function of the slice: no local state, no randomness.
 */
export type PieceDisplayViewModel =
  PieceDisplayShapesViewModel | PieceDisplayFacesViewModel;
