import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useStoryTelescope } from "../../base/useStoryTelescope";
import { createPiece, type Piece } from "../../game/entities";
import type { PieceType } from "../CellDisplay/CellDisplay.types";
import { PieceDisplay } from "./PieceDisplay";
import type { PieceDisplayState } from "./PieceDisplay.types";

/**
 * §5.3 + §5.4 manual-verification catalog (docs/CONVENTIONS.md "Storybook:
 * catalog, not automated tests"). This is the way to visually confirm, per the
 * Phase 6/19 checklists, that every distinct `base=3, dimension=3` piece value
 * renders a distinct shape/stroke/fill (Shapes) or face image (Faces). As with
 * every other story here, the host builds a standalone `Telescope.of` and
 * passes `{ state, telescope }` — the telescope IS the props.
 */
function PieceDisplayHost(props: {
  readonly piece: readonly number[];
  readonly size: number;
  readonly dimension: number;
  readonly pieceType: PieceType;
}): React.ReactElement {
  const { piece, size, dimension, pieceType } = props;

  const { state, telescope } = useStoryTelescope<PieceDisplayState>({
    piece: createPiece(piece, dimension, 3),
    size,
    pieceType,
  });

  return <PieceDisplay state={state} telescope={telescope} />;
}

/** Every `base=3, dimension=3` piece value, in row-major `piece[0]`→`piece[2]` order. */
function allPieces(): readonly Piece[] {
  const out: Piece[] = [];
  for (const h of [0, 1, 2]) {
    for (const e of [0, 1, 2]) {
      for (const m of [0, 1, 2]) out.push(createPiece([h, e, m], 3, 3));
    }
  }
  return out;
}

/** A standalone `PieceDisplay` + its digits, used to tile the 27-piece gallery. */
function PieceGalleryCell(props: {
  readonly piece: Piece;
  readonly size: number;
  readonly pieceType: PieceType;
}): React.ReactElement {
  const { state, telescope } = useStoryTelescope<PieceDisplayState>({
    piece: props.piece,
    size: props.size,
    pieceType: props.pieceType,
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

/** All 27 pieces of one §4.2 skin in a 9×3 grid: one row per `piece[0]`, each row cycling `piece[1]` × `piece[2]`. */
function AllPiecesGallery(props: {
  readonly size: number;
  readonly pieceType: PieceType;
}): React.ReactElement {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(9, auto)",
        gap: 1,
        p: 1,
      }}
    >
      {allPieces().map((piece) => (
        <PieceGalleryCell
          key={piece.join("·")}
          piece={piece}
          size={props.size}
          pieceType={props.pieceType}
        />
      ))}
    </Box>
  );
}

const meta = {
  title: "Board/PieceDisplay",
  component: PieceDisplayHost,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof PieceDisplayHost>;

export default meta;

/**
 * §5.4 (Phase 19): all 27 faces in a 9×3 grid — one row per `piece[0]` (hair
 * color), each row cycling `piece[1]` (eyes) × `piece[2]` (mouth). Every image
 * is the shared `PieceDisplay`'s Faces branch, loaded from the pre-seeded
 * `public/faces/*.png` assets (`/faces/h{h}e{e}m{m}.png`).
 */
export const AllFacesPiecesStory: StoryObj<typeof meta> = {
  args: { piece: [0, 1, 2], size: 64, dimension: 3, pieceType: "Faces" },
  render: () => <AllPiecesGallery size={48} pieceType="Faces" />,
};

/** §5.3: all 27 Shapes pieces in a 9×3 grid — the "visually distinct combination" check. */
export const AllShapesPiecesStory: StoryObj<typeof meta> = {
  args: { piece: [0, 1, 2], size: 64, dimension: 3, pieceType: "Shapes" },
  render: () => <AllPiecesGallery size={48} pieceType="Shapes" />,
};

export const Circle: StoryObj<typeof meta> = {
  args: { piece: [0, 0, 0], size: 96, dimension: 3, pieceType: "Shapes" },
};

export const Triangle: StoryObj<typeof meta> = {
  args: { piece: [1, 1, 1], size: 96, dimension: 3, pieceType: "Shapes" },
};

export const Square: StoryObj<typeof meta> = {
  args: { piece: [2, 2, 2], size: 96, dimension: 3, pieceType: "Shapes" },
};

/** §5.4: one face at display size — the `[0,1,2]` piece's `/faces/h0e1m2.png`. */
export const Face: StoryObj<typeof meta> = {
  args: { piece: [0, 1, 2], size: 96, dimension: 3, pieceType: "Faces" },
};

/**
 * 2-dimensional fallback (dimension=2): `piece[2]` is absent, so §5.3's rule makes the
 * fill fall back to the stroke color — a filled shape with border == fill.
 */
export const TwoDimensionalFallback: StoryObj<typeof meta> = {
  args: { piece: [2, 1], size: 96, dimension: 2, pieceType: "Shapes" },
};

/**
 * 2-dimensional Faces fallback (dimension=2): `piece[2]` is absent, so §5.4's
 * mapping takes the face grid's first mouth — `/faces/h2e1m0.png`.
 */
export const TwoDimensionalFace: StoryObj<typeof meta> = {
  args: { piece: [2, 1], size: 96, dimension: 2, pieceType: "Faces" },
};
