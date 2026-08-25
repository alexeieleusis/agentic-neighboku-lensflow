import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { createPiece, type Piece } from "../../game/entities";
import { cellIndex } from "../../game/gameBuilder";
import { RowDisplay } from "./RowDisplay";
import type { RowDisplayState } from "./RowDisplay.types";

/**
 * A row's `display: contents` children only place inside a CSS grid, so the host
 * emulates `BoardDisplay`'s grid container (same `gridTemplateColumns`/gap) around a
 * single `RowDisplay` — and gives it a fixed width for the centered layout.
 */
function buildRowState(rowIndex: number, size: number): RowDisplayState {
  // Phase 12 §5.2 — a hand-authored fit cache for the fixture's blank (odd) columns,
  // so the §5.2 hints (fit-count badges, hover/tap tooltips) show in the catalog.
  const fits: Piece[] = [
    createPiece([0, 1, 1], 3, 3),
    createPiece([1, 2, 0], 3, 3),
    createPiece([2, 0, 2], 3, 3),
  ];
  const fitsCache = new Map<number, readonly Piece[]>();
  const cells = Array.from({ length: size }, (_, col) => ({
    row: rowIndex,
    col,
    piece: col % 2 === 0 ? createPiece([rowIndex % 3, col % 3, 2], 3, 3) : null,
  }));
  for (const cell of cells) {
    if (cell.piece === null) {
      fitsCache.set(cellIndex(size, cell.row, cell.col), fits);
    }
  }
  return {
    size,
    pieceType: "Shapes",
    rowIndex,
    cells,
    cellToFitPieces: fitsCache,
    hintFitPieceCount: true,
    showFitPiecesOnHover: true,
  };
}

function RowDisplayHost(
  props: Readonly<{ readonly rowIndex: number; readonly size: number }>,
): React.ReactElement {
  const { state, telescope } = useStoryTelescope<RowDisplayState>(
    buildRowState(props.rowIndex, props.size),
  );

  return (
    <Box sx={{ width: 320 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${props.size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${props.size}, auto)`,
          gap: "0.25rem",
        }}
      >
        <RowDisplay state={state} telescope={telescope} />
      </Box>
    </Box>
  );
}

const meta = {
  title: "Board/RowDisplay",
  component: RowDisplayHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof RowDisplayHost>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  args: { rowIndex: 0, size: 6 },
};
