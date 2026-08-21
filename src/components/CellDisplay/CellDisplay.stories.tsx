import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { createPiece } from "../../game/entities";
import { CellDisplay } from "./CellDisplay";
import type { CellDisplayState } from "./CellDisplay.types";

function CellDisplayHost(
  props: Readonly<{
    row: number;
    col: number;
    size: number;
    piece: readonly number[] | null;
  }>,
): React.ReactElement {
  const { state, telescope } = useStoryTelescope<CellDisplayState>({
    size: props.size,
    pieceType: "Shapes",
    row: props.row,
    col: props.col,
    piece: props.piece === null ? null : createPiece(props.piece, 3, 3),
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

export const BlankCell: StoryObj<typeof meta> = {
  args: { row: 1, col: 2, size: 6, piece: null },
};

export const FilledCell: StoryObj<typeof meta> = {
  args: { row: 1, col: 2, size: 6, piece: [1, 2, 0] },
};

export const OtherSection: StoryObj<typeof meta> = {
  args: { row: 4, col: 4, size: 6, piece: [0, 0, 2] },
};
