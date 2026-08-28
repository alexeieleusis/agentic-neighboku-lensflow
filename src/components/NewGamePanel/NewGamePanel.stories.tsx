import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { NewGamePanel } from "./NewGamePanel";
import type { NewGamePanelState } from "./NewGamePanel.types";

/**
 * §5.9 manual-verification catalog (docs/CONVENTIONS.md "Storybook:
 * catalog, not automated tests"). As with every story here, the host builds
 * a standalone `Telescope.of(initialState)` and passes `{ state, telescope }`
 * — the telescope IS the props. Selecting a size moves the panel's LOCAL
 * selection (§4.1's rule applies to it, no emission); Start writes the
 * selected scalars and a fresh `startTime` through the slice's telescope:
 * with a shell wired around it (the `NEW_GAME_PANEL_LENS` setter) that
 * commit rebuilds the board, unfolds a fresh puzzle, resets
 * `gamePlay.startTime`, and closes the drawer (§5.9); in this standalone
 * host the written slice value is the observable commit.
 */
function NewGamePanelHost(
  props: Readonly<NewGamePanelState>,
): React.ReactElement {
  const { state, telescope } = useStoryTelescope<NewGamePanelState>(props);
  return <NewGamePanel state={state} telescope={telescope} />;
}

/**
 * A slice that stands in for the shell's current state: a 4×4 game at the
 * §8.5 load-time forced dimension 3, base 3, with the clock origin
 * back-dated an hour so a Start commit's fresh `startTime` is visible
 * against it.
 */
const SLICE = {
  size: 4,
  dimension: 3,
  base: 3,
  startTime: Date.now() - 3_600_000,
} satisfies NewGamePanelState;

const meta = {
  title: "Fractal Pattern/NewGamePanel (split-hook tier)",
  component: NewGamePanelHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof NewGamePanelHost>;

export default meta;

/**
 * §5.9 defaults: the select opens on 8×8 even though the slice holds a 4×4
 * game; the six §4.1 sizes are the only options; Start commits the 8×8
 * selection with the slice's dimension 3 and base 3.
 */
export const Default: StoryObj<typeof meta> = {
  args: SLICE,
};

/**
 * §4.1's "no prior value" default made visible: a slice holding dimension 2
 * (the §4.1 fallback). First open shows 8×8 with the slice's held dimension 2,
 * not the forced 3: the initializer seeds the pending selection from
 * `initialDimension(slice.dimension)` without running §4.1's size→dimension
 * rule, so Start without touching the select commits 8×8 at dimension 2. All
 * of the rule's observations therefore start from an explicit select change
 * (`selectBoardSize` is where the rule applies) — 4×4 keeps the 2 on Start,
 * 8×8 and above force it to 3, and a later 6×6 keeps the forced 3 (the
 * asymmetry carried forward exactly as observed).
 */
export const PriorDimensionTwo: StoryObj<typeof meta> = {
  args: { ...SLICE, size: 4, dimension: 2 },
};
