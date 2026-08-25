import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import type { Piece } from "../../game/entities";
import { buildBoard } from "../../game/boardBuilder";
import { unfoldGame, type Game } from "../../game/gameBuilder";
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

/**
 * A real, freshly-unfolded game (never a hand-authored fixture): a deterministic
 * Phase 2 board (seed fixed) through Phase 3's unfolding — base-3, 3-dimension for
 * every catalog entry.
 */
function buildGame(size: number, seed: number): Game {
  return unfoldGame(buildBoard(size, 3, 3, seed), {
    preventInvalidMoves: true,
  });
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
 * Mid-game 6×6 tray, both hints off — the Phase 7 baseline: one column per
 * distinct remaining piece value, sorted ascending by base-10-encoded value,
 * each column showing the draggable piece image and its remaining count; no `*`,
 * no click-to-place buttons.
 */
export const Default: StoryObj<typeof meta> = {
  args: {
    game: buildGame(6, 6),
    availablePieceUniqueCell: false,
    pieceCells: false,
  },
};

/**
 * §5.5 second bullet: on this 4×4 the [2,0,1] value is forced — its one remaining
 * copy has exactly one legal fit-cell — so with `availablePieceUniqueCell` on its
 * column shows a `1*` (the "this piece's placement is now forced" hint). Toggle the
 * flag off to confirm the `*` disappears with no other visible change.
 */
export const UniqueCellHint: StoryObj<typeof meta> = {
  args: {
    game: buildGame(4, 4),
    availablePieceUniqueCell: true,
    pieceCells: false,
  },
};

/**
 * §5.5 third bullet: with `pieceCells` on, every column lists one button per legal
 * fit-cell, labeled with the 1-indexed `row,column` of that cell (cell (0,0) is
 * labeled 1,1). This is the keyboard/click-friendly alternative to drag-and-drop:
 * click any button to place that column's piece at exactly that cell, through the
 * same `placePiece` path the drag-and-drop uses.
 */
export const ClickToPlace: StoryObj<typeof meta> = {
  args: {
    game: buildGame(6, 6),
    availablePieceUniqueCell: false,
    pieceCells: true,
  },
};

/** Both §5.5 hint bullets at once: the 4×4's forced column shows `1*` and its one click-to-place button. */
export const BothHintsOn: StoryObj<typeof meta> = {
  args: {
    game: buildGame(4, 4),
    availablePieceUniqueCell: true,
    pieceCells: true,
  },
};

/**
 * A fully-resolved stand-in: the tray emptied and the fit caches dropped (the board
 * itself plays no part in a tray-only story). Demonstrates the "heading, no
 * columns" edge — even with both hints on.
 */
const EMPTY_TRAY_GAME: Game = {
  ...buildGame(6, 6),
  availablePieces: new Map<Piece, number>(),
  pieceToFitCells: new Map<Piece, number[]>(),
  cellToFitPieces: new Map<number, Piece[]>(),
};

export const EmptyTray: StoryObj<typeof meta> = {
  args: {
    game: EMPTY_TRAY_GAME,
    availablePieceUniqueCell: true,
    pieceCells: true,
  },
};
