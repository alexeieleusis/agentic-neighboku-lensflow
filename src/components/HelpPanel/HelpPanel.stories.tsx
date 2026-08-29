import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { HelpPanel } from "./HelpPanel";
import type { HelpPanelState } from "./HelpPanel.types";

/**
 * The fractal pattern's props ARE a telescope, not a plain object — so a story
 * just constructs a standalone `Telescope.of(initialState)` (via
 * `useStoryTelescope`) and passes `{ state, telescope }` directly.
 */
function HelpPanelHost(props: Readonly<HelpPanelState>): React.ReactElement {
  const { state, telescope } = useStoryTelescope<HelpPanelState>(props);

  return <HelpPanel state={state} telescope={telescope} />;
}

const meta = {
  title: "Fractal Pattern/HelpPanel (split-hook tier)",
  component: HelpPanelHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof HelpPanelHost>;

export default meta;

/** The shipped configuration: base 3, dimension 3 — the 27-piece candidate space, in Shapes mode. */
export const Default: StoryObj<typeof meta> = {
  args: { base: 3, dimension: 3, pieceType: "Shapes" },
};

/**
 * §5.4 (Phase 19): the same 27-piece candidate space in Faces mode — the piece
 * selector's options and both neighbor-group groupings render the shared
 * `PieceDisplay`'s face branch (`/faces/h{h}e{e}m{m}.png`), and the Freepik
 * attribution link stays visible (it renders regardless of `pieceType`, §5.10
 * item 6).
 */
export const FacesMode: StoryObj<typeof meta> = {
  args: { base: 3, dimension: 3, pieceType: "Faces" },
};

/** A 2-attribute space (9 pieces): form + border color only, no fill. */
export const TwoDimension: StoryObj<typeof meta> = {
  args: { base: 3, dimension: 2, pieceType: "Shapes" },
};
