import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import type { SolvabilityIconState } from "./SolvabilityIcon.types";
import { SolvabilityIcon } from "./SolvabilityIcon";

/**
 * The fractal pattern's props ARE a telescope, not a plain object — so a story
 * doesn't need the harness convention's createMockProps() helper. The standalone
 * telescope has no lens (the shell's `SOLVABILITY_ICON_LENS` commit path is out
 * of story scope, as with every other component's slice): each story just
 * constructs a standalone `Telescope.of(slice)` and passes `{ state, telescope }`
 * directly.
 */
function SolvabilityIconHost(props: {
  readonly slice: SolvabilityIconState;
}): React.ReactElement {
  const { state, telescope } = useStoryTelescope<SolvabilityIconState>(
    props.slice,
  );

  // The host always returns the element; the element's rendered output may be
  // null (the hidden state), which the `Hidden` story below demonstrates.
  return <SolvabilityIcon state={state} telescope={telescope} />;
}

const meta = {
  title: "Fractal Pattern/SolvabilityIcon (trivial tier)",
  component: SolvabilityIconHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof SolvabilityIconHost>;

export default meta;
// eslint-disable-next-line lensflow/no-typeof-in-type-alias
type Story = StoryObj<typeof meta>;

/** §5.13: `hintGameIsSolvable` on and the position solvable — the happy face (`CheckCircle`, success color). */
export const Solvable: Story = {
  args: { slice: { visible: true, solvable: true } },
};

/** §5.13: `hintGameIsSolvable` on and the position not solvable — the sad face (`ReportProblem`, error color). */
export const Unsolvable: Story = {
  args: { slice: { visible: true, solvable: false } },
};

/** §5.13: `hintGameIsSolvable` off — nothing is shown at all, regardless of solvability. */
export const Hidden: Story = {
  args: { slice: { visible: false, solvable: true } },
};
