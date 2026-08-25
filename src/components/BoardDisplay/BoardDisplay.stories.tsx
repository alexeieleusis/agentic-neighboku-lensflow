import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { createPiece, type Piece } from "../../game/entities";
import { cellIndex } from "../../game/gameBuilder";
import { BoardDisplay } from "./BoardDisplay";
import type { BoardDisplayState, BoardRow } from "./BoardDisplay.types";

/**
 * Fixture for the catalog: alternating filled/blank rows (not a generated board —
 * the app itself renders `BoardDisplay` from a real Phase 3 `Game`). Even rows carry
 * pieces, odd rows are blank, so both the section coloring and the blank-vs-filled
 * distinction are visible at a glance.
 */
function buildBoardState(size: number): BoardDisplayState {
  // Phase 12 §5.2 — a hand-authored fit cache for the fixture's blank (odd) rows:
  // three "would fit" pieces per blank cell, so the §5.2 hints (the fit-count badges
  // and the hover/tap tooltips) are visible in the catalog.
  const fits: Piece[] = [
    createPiece([0, 1, 0], 3, 3),
    createPiece([1, 2, 1], 3, 3),
    createPiece([2, 0, 2], 3, 3),
  ];
  const fitsCache = new Map<number, readonly Piece[]>();
  const rows: BoardRow[] = [];
  for (let row = 0; row < size; row++) {
    const cells = Array.from({ length: size }, (_, col) => ({
      row,
      col,
      piece:
        row % 2 === 0
          ? createPiece([row % 3, col % 3, (row + col) % 3], 3, 3)
          : null,
    }));
    if (row % 2 !== 0) {
      for (let col = 0; col < size; col++) {
        fitsCache.set(cellIndex(size, row, col), fits);
      }
    }
    rows.push({ index: row, cells });
  }
  return {
    size,
    pieceType: "Shapes",
    rows,
    cellToFitPieces: fitsCache,
    hintFitPieceCount: true,
    showFitPiecesOnHover: true,
  };
}

function BoardDisplayHost(
  props: Readonly<{ size: number }>,
): React.ReactElement {
  const { state, telescope } = useStoryTelescope<BoardDisplayState>(
    buildBoardState(props.size),
  );

  // The app's shell bounds the board's width; the story gives it the same treatment
  // explicitly so the `1fr` grid tracks have something to resolve against.
  return (
    <Box sx={{ width: 320 }}>
      <BoardDisplay state={state} telescope={telescope} />
    </Box>
  );
}

const meta = {
  title: "Board/BoardDisplay",
  component: BoardDisplayHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof BoardDisplayHost>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  args: { size: 6 },
};

export const Small4x4: StoryObj<typeof meta> = {
  args: { size: 4 },
};
