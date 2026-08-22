import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type {
  PieceDisplayState,
  PieceDisplayViewModel,
} from "./PieceDisplay.types";
import { usePieceDisplayViewModel } from "./usePieceDisplayViewModel";
import type { PieceForm } from "./pieceShapeTables";
import {
  CIRCLE_RADIUS,
  PIECE_CENTER,
  PIECE_VIEWBOX,
  SQUARE_HALF_SIDE,
  trianglePoints,
} from "./pieceShapeTables";

/**
 * §5.3 — the shared piece-rendering component (Shapes mode). It is `state,telescope →
 * usePieceDisplayViewModel → RenderPieceDisplay` (requirements §7.2) and is trivial-tier:
 * a lookup-table-driven SVG renderer with no local state or user actions. Faces-mode
 * rendering (§5.4, the image grid keyed by `h{h}e{e}m{m}.png`) is explicitly out of scope
 * here and lands in Phase 19.
 *
 * Rendering is a pure function of the piece value: the same `piece[0]/piece[1]/piece[2]`
 * always draws the same shape, stroke color, and fill color (no hidden state, no
 * randomness). The internal `PIECE_VIEWBOX` is mapped onto the requested `size` via the
 * SVG `viewBox`, so the component is usable at any display scale.
 */
export const PieceDisplay: TelescopeComponent<PieceDisplayState> = function (
  props: TelescopedProps<PieceDisplayState>,
): React.ReactElement {
  return RenderPieceDisplay(usePieceDisplayViewModel(props));
};

function RenderPieceDisplay(
  viewModel: Readonly<PieceDisplayViewModel>,
): React.ReactElement {
  const { form, strokeColor, fillColor, strokeWidth, size, ariaLabel } =
    viewModel;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${PIECE_VIEWBOX} ${PIECE_VIEWBOX}`}
    >
      <title>{ariaLabel}</title>
      <PieceShape
        form={form}
        strokeColor={strokeColor}
        fillColor={fillColor}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

/**
 * The §5.3 form → SVG shape dispatch. Purely presentational: given a precomputed
 * view-model, it only chooses which SVG element draws the shape. All the data the shape
 * needs (form, colors, stroke width) arrives already computed by `usePieceDisplayViewModel`.
 */
function PieceShape(props: Readonly<{
  readonly form: PieceForm;
  readonly strokeColor: string;
  readonly fillColor: string;
  readonly strokeWidth: number;
}>): React.ReactElement {
  const { form, strokeColor, fillColor, strokeWidth } = props;
  const paint = {
    fill: fillColor,
    stroke: strokeColor,
    strokeWidth,
  };

  switch (form) {
    case "circle":
      return (
        <circle cx={PIECE_CENTER} cy={PIECE_CENTER} r={CIRCLE_RADIUS} {...paint} />
      );
    case "triangle":
      return <polygon points={trianglePoints()} {...paint} />;
    case "square":
      return (
        <rect
          x={PIECE_CENTER - SQUARE_HALF_SIDE}
          y={PIECE_CENTER - SQUARE_HALF_SIDE}
          width={SQUARE_HALF_SIDE * 2}
          height={SQUARE_HALF_SIDE * 2}
          {...paint}
        />
      );
    default: {
      // `PieceForm` is a closed union; this branch is unreachable and is the
      // compile-time exhaustiveness check the §5.3 table promises.
      const exhaustive: never = form;
      throw new Error(`PieceDisplay: unhandled form ${String(exhaustive)}`);
    }
  }
}