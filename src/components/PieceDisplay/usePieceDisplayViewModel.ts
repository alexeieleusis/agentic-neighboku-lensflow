import type { TelescopedProps } from "../../base/TelescopeComponent";
import { formOf, fillColor, strokeColor } from "./pieceShapeTables";
import type {
  PieceDisplayState,
  PieceDisplayViewModel,
} from "./PieceDisplay.types";

/**
 * Trivial tier (`requirements.md` §7.2.1): a Shapes-mode piece is a lookup-table-driven
 * renderer with no local UI state, no user actions, and no telescope writes — so it keeps
 * one flat view-model hook; no `useXDomain`/`useXState`/`useXActions` split. The mapping
 * from `piece` to its §5.3 visual attributes is table data in `pieceShapeTables.ts`; this
 * hook only assembles it into the view-model shape `RenderPieceDisplay` consumes.
 */
export function usePieceDisplayViewModel(
  props: Readonly<TelescopedProps<PieceDisplayState>>,
): PieceDisplayViewModel {
  const { piece, size } = props.state;

  const form = formOf(piece);
  const stroke = strokeColor(piece);
  const fill = fillColor(piece);

  return {
    form: form.form,
    strokeColor: stroke,
    fillColor: fill,
    strokeWidth: form.strokeWidth,
    size,
    ariaLabel: `${form.form}, ${stroke} border, ${fill} fill`,
  };
}