import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type {
  CellDisplayState,
  CellDisplayViewModel,
} from "./CellDisplay.types";
import { useCellDisplayViewModel } from "./useCellDisplayViewModel";
import { FIT_PIECE_IMAGE_PX } from "./useCellDisplayDomain";
import { PieceDisplay } from "../PieceDisplay/PieceDisplay";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";

/**
 * §5.2 + §5.6 — one board cell. It positions itself on the board grid with its view
 * model's `gridRow`/`gridColumn` and paints its section-keyed `backgroundColor`. A blank
 * cell is the `cell-{row}-{col}` droppable target (§5.6): its root element carries the
 * `useDroppable` node ref, and the dashed "drop here" ring turns solid while a piece is
 * dragged over it. Phase 12 makes the same cell the §5.2 hint surface: a fit-count
 * badge when `hintFitPieceCount` is on (never on a filled cell, never when the
 * preference is off), and a hover/tap tooltip listing every piece that would fit via
 * shared `PieceDisplay` thumbnails when `showFitPiecesOnHover` is on — both derived
 * from the Phase 3 `cellToFitPieces` cache via the view model. A filled cell renders
 * its piece through the shared `PieceDisplay` (fed by a magnified piece-image slice,
 * the same §7.2 parent→child flow as the tooltip thumbnails and the tray columns, so
 * the §4.2 Shapes/Faces skin toggle reaches it uniformly). The actual drop is
 * committed by the shell's `handleDragEnd` — this cell only advertises the target.
 */
export const CellDisplay: TelescopeComponent<CellDisplayState> = function (
  props: TelescopedProps<CellDisplayState>,
): React.ReactElement {
  return RenderCellDisplay(useCellDisplayViewModel(props));
};

function RenderCellDisplay(
  viewModel: Readonly<CellDisplayViewModel>,
): React.ReactElement {
  const {
    gridRow,
    gridColumn,
    backgroundColor,
    piece,
    pieceImage,
    isOver,
    fitCount,
    fitCountVisible,
    fitPiecesTooltipOpen,
    fitPieceImages,
    droppableNodeRef,
    onCellMouseEnter,
    onCellMouseLeave,
    onCellTap,
  } = viewModel;

  // The §5.2 tooltip wraps the §5.6 cell root: controlled `open`/`title` (the view model
  // precomputes both), and MUI's own trigger listeners and interactivity disabled —
  // `disableInteractive` keeps the open tooltip's content pointer-transparent (MUI's
  // default open tooltip captures the pointer, which would fire this cell's
  // `onMouseLeave`, close the tooltip, re-fire `onMouseEnter`, and so on — a hover
  // flicker loop). The reveal is driven entirely by this cell's own enter/leave/tap
  // handlers on the wrapped root box; `disableHoverListener`/`disableTouchListener`
  // keep MUI from double-driving it. MUI forks the root box's own ref with its anchor
  // ref, so the `useDroppable` node ref is preserved.
  return (
    <Tooltip
      open={fitPiecesTooltipOpen}
      title={
        fitPieceImages.length > 0 ? (
          <FitPieceThumbnails images={fitPieceImages} />
        ) : null
      }
      disableHoverListener
      disableTouchListener
      disableInteractive
    >
      <Box
        ref={droppableNodeRef}
        onMouseEnter={onCellMouseEnter}
        onMouseLeave={onCellMouseLeave}
        onClick={onCellTap}
        sx={{
          gridRow,
          gridColumn,
          backgroundColor,
          aspectRatio: "1",
          position: "relative",
          display: "grid",
          placeItems: "center",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 0.5,
        }}
      >
        {piece !== null && pieceImage !== null ? (
          // §5.3/§5.4 — the placed piece via the shared `PieceDisplay` (both §4.2
          // skins), at the cell's piece scale; the wrapper's accessible name keeps the
          // piece's digits and the cell's position.
          <Box
            role="img"
            aria-label={`Piece ${piece.join(
              " ",
            )}, row ${gridRow}, column ${gridColumn}`}
          >
            <PieceDisplay {...pieceImage} />
          </Box>
        ) : (
          // The §5.6 droppable target plus the Phase 12 §5.2 hint surface: the dashed
          // "drop here" ring turns solid while a piece is dragged over the cell, and —
          // when `hintFitPieceCount` is on — the top-right badge shows how many pieces
          // would fit. Both render only on blank cells; neither does on a filled one.
          <>
            <Box
              aria-hidden
              sx={{
                width: "60%",
                height: "60%",
                border: isOver ? "2px solid" : "1px dashed",
                borderColor: isOver ? "primary.main" : "text.disabled",
                transition: "border-color 100ms, border-width 100ms",
                borderRadius: 0.5,
              }}
            />
            {fitCountVisible && (
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: 0.25,
                  right: 0.5,
                  color: "text.secondary",
                  opacity: 0.9,
                  fontWeight: 500,
                }}
              >
                {fitCount}
              </Typography>
            )}
          </>
        )}
      </Box>
    </Tooltip>
  );
}

/**
 * §5.2 tooltip content: one shared `PieceDisplay` thumbnail per piece that would fit
 * this cell, six per row at the 32px thumbnail size, so even the densest fit list
 * stays a compact, scannable panel.
 */
function FitPieceThumbnails(
  props: Readonly<{
    readonly images: readonly TelescopedProps<PieceDisplayState>[];
  }>,
): React.ReactElement {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(6, ${FIT_PIECE_IMAGE_PX}px)`,
        gap: 0.5,
        p: 0.5,
      }}
    >
      {props.images.map((image) => (
        <PieceDisplay key={image.state.piece.join("·")} {...image} />
      ))}
    </Box>
  );
}
