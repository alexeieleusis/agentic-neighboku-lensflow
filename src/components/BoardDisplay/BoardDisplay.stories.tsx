import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { createPiece } from "../../game/entities";
import { BoardDisplay } from "./BoardDisplay";
import type { BoardDisplayState, BoardRow } from "./BoardDisplay.types";

/**
 * Fixture for the catalog: alternating filled/blank rows (not a generated board —
 * the app itself renders `BoardDisplay` from a real Phase 3 `Game`). Even rows carry
 * pieces, odd rows are blank, so both the section coloring and the blank-vs-filled
 * distinction are visible at a glance.
 */
function buildBoardState(size: number): BoardDisplayState {
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
    rows.push({ index: row, cells });
  }
  return { size, pieceType: "Shapes", rows };
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
