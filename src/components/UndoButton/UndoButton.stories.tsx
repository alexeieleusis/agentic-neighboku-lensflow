import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { UndoButton } from "./UndoButton";
import type { UndoButtonState } from "./UndoButton.types";

/**
 * The fractal pattern's props ARE a telescope, not a plain object — so a story
 * doesn't need the harness convention's createMockProps() helper. The standalone
 * telescope has no lens, so a click simply writes the post-undo slice value;
 * the App shell's undo lens (the real `undoPlay` commit path) is out of story
 * scope, as with every other component's slice.
 */
function UndoButtonHost(props: {
  readonly placedMoves: number;
}): React.ReactElement {
  const { state, telescope } = useStoryTelescope<UndoButtonState>({
    placedMoves: props.placedMoves,
  });

  return <UndoButton state={state} telescope={telescope} />;
}

const meta = {
  title: "Fractal Pattern/UndoButton (trivial tier)",
  component: UndoButtonHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof UndoButtonHost>;

export default meta;
// eslint-disable-next-line lensflow/no-typeof-in-type-alias
type Story = StoryObj<typeof meta>;

export const NoMovesDisabled: Story = {
  args: { placedMoves: 0 },
};

export const MovesAvailable: Story = {
  args: { placedMoves: 3 },
};
