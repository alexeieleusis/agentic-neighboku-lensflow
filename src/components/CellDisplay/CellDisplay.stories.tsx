import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { createPiece } from "../../game/entities";
import type { CellFitCache } from "../../game/gameBuilder";
import { cellIndex } from "../../game/gameBuilder";
import { CellDisplay } from "./CellDisplay";
import type { CellDisplayState } from "./CellDisplay.types";

/**
 * Phase 12 §5.2 — the fit cache a story cell reads its hints from: this single cell →
 * the given pieces. Hand-authored (the app itself feeds `CellDisplay` from a real
 * Phase 3 `Game`, whose `cellToFitPieces` cache is what these stories mirror in shape).
 */
function buildFitCache(
  size: number,
  row: number,
  col: number,
  fits: readonly (readonly number[])[],
): CellFitCache {
  const fitPieces = fits.map((digits) => createPiece(digits, 3, 3));
  return new Map([[cellIndex(size, row, col), fitPieces]]);
}

function CellDisplayHost(props: {
  readonly row: number;
  readonly col: number;
  readonly size: number;
  readonly piece: readonly number[] | null;
  readonly fits: readonly (readonly number[])[];
  readonly hintFitPieceCount: boolean;
  readonly showFitPiecesOnHover: boolean;
}): React.ReactElement {
  const { state, telescope } = useStoryTelescope<CellDisplayState>({
    size: props.size,
    pieceType: "Shapes",
    row: props.row,
    col: props.col,
    piece: props.piece === null ? null : createPiece(props.piece, 3, 3),
    cellToFitPieces: buildFitCache(
      props.size,
      props.row,
      props.col,
      props.fits,
    ),
    hintFitPieceCount: props.hintFitPieceCount,
    showFitPiecesOnHover: props.showFitPiecesOnHover,
  });

  return <CellDisplay state={state} telescope={telescope} />;
}

const meta = {
  title: "Board/CellDisplay",
  component: CellDisplayHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof CellDisplayHost>;

export default meta;

/**
 * Phase 12 §5.2 — the default blank cell: `hintFitPieceCount` on shows its fit-count
 * badge (top-right), `showFitPiecesOnHover` on reveals the fit-pieces tooltip on
 * hover (desktop) or tap.
 */
export const BlankCell: StoryObj<typeof meta> = {
  args: {
    row: 1,
    col: 2,
    size: 6,
    piece: null,
    fits: [
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2],
    ],
    hintFitPieceCount: true,
    showFitPiecesOnHover: true,
  },
};

/** Both hints off: a bare drop target with no badge and no tooltip. */
export const BlankCellHintsOff: StoryObj<typeof meta> = {
  args: {
    row: 1,
    col: 2,
    size: 6,
    piece: null,
    fits: [
      [0, 0, 0],
      [1, 1, 1],
    ],
    hintFitPieceCount: false,
    showFitPiecesOnHover: false,
  },
};

/**
 * A blank cell nothing would fit (unsolvable position): the count still shows "0" when
 * the hint is on, and the tooltip never appears — there is nothing to list.
 */
export const BlankCellNoFits: StoryObj<typeof meta> = {
  args: {
    row: 1,
    col: 2,
    size: 6,
    piece: null,
    fits: [],
    hintFitPieceCount: true,
    showFitPiecesOnHover: true,
  },
};

/** A filled cell never shows a count or tooltip, regardless of the hint preferences. */
export const FilledCellIgnoresHints: StoryObj<typeof meta> = {
  args: {
    row: 1,
    col: 2,
    size: 6,
    piece: [1, 2, 0],
    fits: [
      [0, 0, 0],
      [1, 1, 1],
    ],
    hintFitPieceCount: true,
    showFitPiecesOnHover: true,
  },
};

export const OtherSection: StoryObj<typeof meta> = {
  args: {
    row: 4,
    col: 4,
    size: 6,
    piece: [0, 0, 2],
    fits: [],
    hintFitPieceCount: true,
    showFitPiecesOnHover: true,
  },
};
