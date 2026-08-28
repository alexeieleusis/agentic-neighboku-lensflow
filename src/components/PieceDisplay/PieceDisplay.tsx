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
 * §5.3 + §5.4 — the shared piece-rendering component (both §4.2 skins). It is
 * `state,telescope → usePieceDisplayViewModel → RenderPieceDisplay`
 * (requirements §7.2) and is trivial-tier: a lookup-table-driven renderer with
 * no local state or user actions. The slice's `pieceType` (§4.2) selects the
 * branch: Shapes draws the §5.3 shape/stroke/fill SVG, Faces draws the §5.4
 * image `/faces/h{h}e{e}m{m}.png` (one of the 27 pre-seeded `public/faces/*.png`
 * assets — this component never authors or regenerates them).
 *
 * Rendering is a pure function of the piece value and the skin: the same
 * `piece[0]/piece[1]/piece[2]` always draws the same shape, stroke color, and
 * fill color (Shapes) or the same face image (Faces) — no hidden state, no
 * randomness. Because this one component owns both branches and every consumer
 * (the board's fit-piece tooltip, the tray, the Help panel) feeds pieces through
 * it, the §4.2 mode switch applies uniformly: no consumer carries a separate
 * Faces-rendering implementation. The internal `PIECE_VIEWBOX` maps onto the
 * requested `size` via the SVG `viewBox` (Shapes), and the `<img>` is pinned to
 * `size` (Faces), so the component is usable at any display scale.
 */
export const PieceDisplay: TelescopeComponent<PieceDisplayState> = function (
  props: TelescopedProps<PieceDisplayState>,
): React.ReactElement {
  return RenderPieceDisplay(usePieceDisplayViewModel(props));
};

function RenderPieceDisplay(
  viewModel: Readonly<PieceDisplayViewModel>,
): React.ReactElement {
  if (viewModel.pieceType === "Faces") {
    return RenderFacePiece(viewModel);
  }
  return RenderShapePiece(viewModel);
}

/**
 * §5.4 branch: the piece's face image at the slice's `size`. A plain `<img>` —
 * the asset is a static PNG, so no SVG machinery; `alt` carries the face's
 * accessible name (the view model's `ariaLabel`), and `draggable={false}` keeps
 * the browser's native image-drag from fighting dnd-kit when this piece is the
 * tray's draggable node.
 */
function RenderFacePiece(
  viewModel: Readonly<{
    readonly faceImagePath: string;
    readonly size: number;
    readonly ariaLabel: string;
  }>,
): React.ReactElement {
  const { faceImagePath, size, ariaLabel } = viewModel;
  return (
    <img
      src={faceImagePath}
      alt={ariaLabel}
      width={size}
      height={size}
      draggable={false}
    />
  );
}

/**
 * §5.3 branch: the piece's shape in its internal coordinate space. Purely
 * presentational: given the precomputed Shapes view model, it only draws the
 * SVG — all the data the shape needs (form, colors, stroke width) arrives
 * already computed by `usePieceDisplayViewModel`.
 */
function RenderShapePiece(viewModel: {
  readonly form: PieceForm;
  readonly strokeColor: string;
  readonly fillColor: string;
  readonly strokeWidth: number;
  readonly size: number;
  readonly ariaLabel: string;
}): React.ReactElement {
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
function PieceShape(
  props: Readonly<{
    readonly form: PieceForm;
    readonly strokeColor: string;
    readonly fillColor: string;
    readonly strokeWidth: number;
  }>,
): React.ReactElement {
  const { form, strokeColor, fillColor, strokeWidth } = props;
  const paint = {
    fill: fillColor,
    stroke: strokeColor,
    strokeWidth,
  };

  switch (form) {
    case "circle":
      return (
        <circle
          cx={PIECE_CENTER}
          cy={PIECE_CENTER}
          r={CIRCLE_RADIUS}
          {...paint}
        />
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
