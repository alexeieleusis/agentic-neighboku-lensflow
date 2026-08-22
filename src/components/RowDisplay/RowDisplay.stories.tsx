import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { createPiece } from "../../game/entities";
import { RowDisplay } from "./RowDisplay";
import type { RowDisplayState } from "./RowDisplay.types";

/**
 * A row's `display: contents` children only place inside a CSS grid, so the host
 * emulates `BoardDisplay`'s grid container (same `gridTemplateColumns`/gap) around a
 * single `RowDisplay` — and gives it a fixed width for the centered layout.
 */
function buildRowState(rowIndex: number, size: number): RowDisplayState {
  return {
    size,
    pieceType: "Shapes",
    rowIndex,
    cells: Array.from({ length: size }, (_, col) => ({
      row: rowIndex,
      col,
      piece:
        col % 2 === 0 ? createPiece([rowIndex % 3, col % 3, 2], 3, 3) : null,
    })),
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
