import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { createPiece, type Piece } from "../../game/entities";
import type { Tray } from "../../game/gameBuilder";
import { AvailablePiecesTray } from "./AvailablePiecesTray";
import type { AvailablePiecesTrayState } from "./AvailablePiecesTray.types";

/**
 * §5.5 manual-verification catalog (docs/CONVENTIONS.md "Storybook: catalog, not
 * automated tests"). As with every story here, the host builds a standalone
 * `Telescope.of(initialState)` and passes `{ state, telescope }` — the telescope IS
 * the props.
 */
function AvailablePiecesTrayHost(
  props: Readonly<AvailablePiecesTrayState>,
): React.ReactElement {
  const { state, telescope } =
    useStoryTelescope<AvailablePiecesTrayState>(props);

  return <AvailablePiecesTray state={state} telescope={telescope} />;
}

/** Build a domain `Tray` from `[digits, count]` pairs (base-3, 3-d interned pieces). */
function trayOf(
  entries: ReadonlyArray<readonly [readonly number[], number]>,
): Tray {
  const tray = new Map<Piece, number>();
  for (const [digits, count] of entries) {
    tray.set(createPiece(digits, 3, 3), count);
  }
  return tray;
}

const meta = {
  title: "Board/AvailablePiecesTray",
  component: AvailablePiecesTrayHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof AvailablePiecesTrayHost>;

export default meta;

/**
 * Mid-game tray on a 6×6 board (width 336px). Map insertion order is deliberately
 * unsorted to confirm the columns render ascending by base-10-encoded value
 * (0,0,0 → 0, then 0,2,0 → 20, then 1,0,0 → 100, then 1,1,1 → 111, then 2,1,0 → 210).
 */
export const Default: StoryObj<typeof meta> = {
  args: {
    size: 6,
    availablePieces: trayOf([
      [[1, 1, 1], 2],
      [[0, 2, 0], 1],
      [[0, 0, 0], 3],
      [[1, 0, 0], 1],
      [[2, 1, 0], 4],
    ]),
  },
};

/**
 * The §5.5 width rule made visible: the same tray on a 12×12 board is 672px wide vs
 * 336px on the Default's 6×6. Compare the two stories side by side.
 */
export const LargeBoard: StoryObj<typeof meta> = {
  args: {
    size: 12,
    availablePieces: trayOf([
      [[1, 1, 1], 2],
      [[0, 2, 0], 1],
      [[0, 0, 0], 3],
      [[1, 0, 0], 1],
      [[2, 1, 0], 4],
    ]),
  },
};

/** An emptied tray: no columns at all (every piece value fully placed). */
export const EmptyTray: StoryObj<typeof meta> = {
  args: {
    size: 6,
    availablePieces: trayOf([]),
  },
};
