import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { createPiece, type Piece } from "../../game/entities";
import { PieceDisplay } from "./PieceDisplay";
import type { PieceDisplayState } from "./PieceDisplay.types";

/**
 * §5.3 manual-verification catalog (docs/CONVENTIONS.md "Storybook: catalog, not automated
 * tests"). `PieceDisplay` is not yet wired into the board/tray (that lands in a later
 * phase), so this story is the way to visually confirm, per the Phase 6 checklist, that
 * every distinct `base=3, dimension=3` piece value renders a distinct shape/stroke/fill.
 * As with every other story here, the host builds a standalone `Telescope.of` and passes
 * `{ state, telescope }` — the telescope IS the props.
 */
function PieceDisplayHost(props: {
  readonly piece: readonly number[];
  readonly size: number;
  readonly dimension: number;
}): React.ReactElement {
  const { piece, size, dimension } = props;

  const { state, telescope } = useStoryTelescope<PieceDisplayState>({
    piece: createPiece(piece, dimension, 3),
    size,
  });

  return <PieceDisplay state={state} telescope={telescope} />;
}

/** Every `base=3, dimension=3` piece value, in row-major `piece[0]`→`piece[2]` order. */
function allShapesPieces(): readonly Piece[] {
  const out: Piece[] = [];
  for (const form of [0, 1, 2]) {
    for (const stroke of [0, 1, 2]) {
      for (const fill of [0, 1, 2]) {
        out.push(createPiece([form, stroke, fill], 3, 3));
      }
    }
  }
  return out;
}

/** A standalone `PieceDisplay` + its digits, used to tile the 27-piece gallery. */
function PieceGalleryCell(props: {
  readonly piece: Piece;
  readonly size: number;
}): React.ReactElement {
  const { state, telescope } = useStoryTelescope<PieceDisplayState>({
    piece: props.piece,
    size: props.size,
  });

  return (
    <Box sx={{ display: "grid", placeItems: "center", gap: 0.25, p: 0.5 }}>
      <PieceDisplay state={state} telescope={telescope} />
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        {props.piece.map(String).join("·")}
      </Typography>
    </Box>
  );
}

/**
 * All 27 Shapes pieces in a 9×3 grid: one row per `piece[0]` (circle/triangle/square),
 * each row cycling the 3 stroke colors × 3 fill colors. This is the "visually distinct
 * combination" check for the Phase 6 acceptance criteria.
 */
function AllShapesPieces(props: { readonly size: number }): React.ReactElement {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(9, auto)",
        gap: 1,
        p: 1,
      }}
    >
      {allShapesPieces().map((piece) => (
        <PieceGalleryCell
          key={piece.join("·")}
          piece={piece}
          size={props.size}
        />
      ))}
    </Box>
  );
}

const meta = {
  title: "Board/PieceDisplay (Shapes)",
  component: PieceDisplayHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof PieceDisplayHost>;

export default meta;

export const AllShapesPiecesStory: StoryObj<typeof meta> = {
  args: { piece: [0, 1, 2], size: 64, dimension: 3 },
  render: () => <AllShapesPieces size={48} />,
};

export const Circle: StoryObj<typeof meta> = {
  args: { piece: [0, 0, 0], size: 96, dimension: 3 },
};

export const Triangle: StoryObj<typeof meta> = {
  args: { piece: [1, 1, 1], size: 96, dimension: 3 },
};

export const Square: StoryObj<typeof meta> = {
  args: { piece: [2, 2, 2], size: 96, dimension: 3 },
};

/**
 * 2-dimensional fallback (dimension=2): `piece[2]` is absent, so §5.3's rule makes the
 * fill fall back to the stroke color — a filled shape with border == fill.
 */
export const TwoDimensionalFallback: StoryObj<typeof meta> = {
  args: { piece: [2, 1], size: 96, dimension: 2 },
};
