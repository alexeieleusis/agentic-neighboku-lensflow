import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { CounterDisplay } from "./CounterDisplay";
import type { CounterDisplayState } from "./CounterDisplay.types";

/**
 * The fractal pattern's props ARE a telescope, not a plain object — so a story doesn't
 * need the harness convention's createMockProps() helper.
 */
function CounterDisplayHost(props: {
  readonly initialCount: number;
}): React.ReactElement {
  const { state, telescope } = useStoryTelescope<CounterDisplayState>({
    count: props.initialCount,
  });

  return <CounterDisplay state={state} telescope={telescope} />;
}

const meta = {
  title: "Fractal Pattern/CounterDisplay (trivial tier)",
  component: CounterDisplayHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof CounterDisplayHost>;

export default meta;
// eslint-disable-next-line lensflow/no-typeof-in-type-alias
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { initialCount: 0 },
};

export const StartingHigh: Story = {
  args: { initialCount: 42 },
};
