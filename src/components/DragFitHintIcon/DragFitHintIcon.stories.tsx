import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import type { DragHint } from "../DraggablePiece/DraggablePiece.types";
import { DragFitHintIcon } from "./DragFitHintIcon";

/**
 * The fractal pattern's props ARE a telescope, not a plain object — so a story
 * doesn't need the harness convention's createMockProps() helper. The standalone
 * telescope has no lens (the shell's `DRAG_HINT_LENS` commit path is out of story
 * scope, as with every other component's slice): each story just constructs a
 * standalone `Telescope.of(hint)` and passes `{ state, telescope }` directly.
 */
function DragFitHintIconHost(props: {
  readonly hint: DragHint;
}): React.ReactElement {
  const { state, telescope } = useStoryTelescope<DragHint>(props.hint);

  return <DragFitHintIcon state={state} telescope={telescope} />;
}

const meta = {
  title: "Fractal Pattern/DragFitHintIcon (trivial tier)",
  component: DragFitHintIconHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof DragFitHintIconHost>;

export default meta;
// eslint-disable-next-line lensflow/no-typeof-in-type-alias
type Story = StoryObj<typeof meta>;

/** §5.6: no drag in progress — the info icon. */
export const None: Story = {
  args: { hint: "None" },
};

/** §5.6: a drag in progress, but no droppable target hovered (or `hintFitOnDrag` off) — the info icon. */
export const Unknown: Story = {
  args: { hint: "Unknown" },
};

/** §5.6: the dragged piece is over a legal placement — the thumbs-up icon. */
export const Ok: Story = {
  args: { hint: "Ok" },
};

/** §5.6: the dragged piece is over an illegal placement — the thumbs-down icon. */
export const NotOk: Story = {
  args: { hint: "NotOk" },
};
