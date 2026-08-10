import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { FaceSwatchBoard } from "./FaceSwatchBoard";
import type { FaceSwatchBoardState } from "./FaceSwatchBoard.types";

function FaceSwatchBoardHost(
  props: Readonly<FaceSwatchBoardState>,
): React.ReactElement {
  const { state, telescope } = useStoryTelescope<FaceSwatchBoardState>(props);

  return <FaceSwatchBoard state={state} telescope={telescope} />;
}

const meta = {
  title: "Fractal Pattern/FaceSwatchBoard (split-hook tier)",
  component: FaceSwatchBoardHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof FaceSwatchBoardHost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    trayTileIds: ["h0e0m0", "h0e1m2", "h1e0m1", "h2e2m0"],
    slotTileId: null,
  },
};

export const SlotFilled: Story = {
  args: {
    trayTileIds: ["h0e0m0", "h0e1m2", "h1e0m1"],
    slotTileId: "h2e2m0",
  },
};
