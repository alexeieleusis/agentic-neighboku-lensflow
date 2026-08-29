import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import type { AppPreferences } from "../../App.types";
import { PreferencesDisplay } from "./PreferencesDisplay";
import type { PreferencesDisplayState } from "./PreferencesDisplay.types";

/**
 * §5.8 manual-verification catalog (docs/CONVENTIONS.md "Storybook: catalog,
 * not automated tests"). As with every story here, the host builds a
 * standalone `Telescope.of(initialState)` and passes `{ state, telescope }` —
 * the telescope IS the props. Toggling any control commits through that
 * slice's telescope: with a shell wired around it, the change would land on
 * `AppState.preferences` and persist to `localStorage` on the same emission
 * (§4.3); in this standalone host the slice itself is the observable commit.
 */
function PreferencesDisplayHost(
  props: Readonly<PreferencesDisplayState>,
): React.ReactElement {
  const { state, telescope } =
    useStoryTelescope<PreferencesDisplayState>(props);
  return <PreferencesDisplay state={state} telescope={telescope} />;
}

/** §4.2 default preferences — every control at its first-load value. */
const DEFAULTS = {
  scalars: { base: 3, dimension: 3, size: 6 },
  pieceType: "Faces",
  hints: {
    fitPieceCount: true,
    pieceCells: false,
    fitOnDrag: true,
    showFitPiecesOnHover: true,
    availablePiecesCount: true,
    availablePieceUniqueCell: true,
    gameIsSolvable: true,
  },
  preventInvalidMoves: true,
  sound: true,
} satisfies AppPreferences;

const meta = {
  title: "Fractal Pattern/PreferencesDisplay (split-hook tier)",
  component: PreferencesDisplayHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof PreferencesDisplayHost>;

export default meta;

/** §4.2 defaults: `pieceType` Faces, every §5.8 boolean at its first-load value. */
export const Default: StoryObj<typeof meta> = {
  args: DEFAULTS,
};

/**
 * The §5.8 correction note made concrete: `pieceType` is a categorical
 * "Shapes"/"Faces" choice (a two-option radio row, not a `Switch`), here with
 * "Shapes" selected.
 */
export const ShapesPieceType: StoryObj<typeof meta> = {
  args: { ...DEFAULTS, pieceType: "Shapes" },
};

/**
 * Every §5.8 boolean off — the all-off corner of the panel, useful for
 * confirming no row is hard-wired on. (Not what a `{ "sound": false }` stored
 * blob resolves to after §4.3's merge: that keeps every other default.)
 */
export const AllOff: StoryObj<typeof meta> = {
  args: {
    scalars: { base: 3, dimension: 3, size: 6 },
    pieceType: "Faces",
    hints: {
      fitPieceCount: false,
      pieceCells: false,
      fitOnDrag: false,
      showFitPiecesOnHover: false,
      availablePiecesCount: false,
      availablePieceUniqueCell: false,
      gameIsSolvable: false,
    },
    preventInvalidMoves: false,
    sound: false,
  },
};
