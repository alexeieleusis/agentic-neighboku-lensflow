import type { TelescopedProps } from "../../base/TelescopeComponent";
import { formOf, fillColor, strokeColor } from "./pieceShapeTables";
import { faceImagePathFor, faceLabelFor } from "./pieceFaceTables";
import type {
  PieceDisplayState,
  PieceDisplayViewModel,
} from "./PieceDisplay.types";

/**
 * Trivial tier (`requirements.md` §7.2.1): a piece in either §4.2 skin is a
 * lookup-table-driven renderer with no local UI state, no user actions, and no
 * telescope writes — so it keeps one flat view-model hook; no
 * `useXDomain`/`useXState`/`useXActions` split. The slice's `pieceType` selects
 * which table the mapping comes from: §5.3's shape/stroke/fill tables
 * (`pieceShapeTables.ts`) or §5.4's face-image mapping (`pieceFaceTables.ts`);
 * this hook only assembles the winning table into the view-model branch
 * `RenderPieceDisplay` consumes.
 */
export function usePieceDisplayViewModel(
  props: Readonly<TelescopedProps<PieceDisplayState>>,
): PieceDisplayViewModel {
  const { piece, size, pieceType } = props.state;

  if (pieceType === "Faces") {
    // §5.4: the piece is one of the 27 pre-seeded face images; the path and the
    // accessible label are the pure `pieceFaceTables` mappings.
    return {
      pieceType,
      faceImagePath: faceImagePathFor(piece),
      size,
      ariaLabel: faceLabelFor(piece),
    };
  }

  // §5.3: the three visual attributes off the shape tables.
  const form = formOf(piece);
  const stroke = strokeColor(piece);
  const fill = fillColor(piece);

  return {
    pieceType,
    form: form.form,
    strokeColor: stroke,
    fillColor: fill,
    strokeWidth: form.strokeWidth,
    size,
    ariaLabel: `${form.form}, ${stroke} border, ${fill} fill`,
  };
}
