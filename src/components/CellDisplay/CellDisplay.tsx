import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type {
  CellDisplayState,
  CellDisplayViewModel,
} from "./CellDisplay.types";
import { useCellDisplayViewModel } from "./useCellDisplayViewModel";

/**
 * §5.2 + §5.6 — one board cell. It positions itself on the board grid with its view
 * model's `gridRow`/`gridColumn` and paints its section-keyed `backgroundColor`. A blank
 * cell is the `cell-{row}-{col}` droppable target (§5.6): its root element carries the
 * `useDroppable` node ref, and the dashed "drop here" ring turns solid while a piece is
 * dragged over it (the Phase 12 fit hints extend it further). A filled cell shows a
 * minimal inline placeholder for its piece; the shared `PieceDisplay` (Phases 6–19)
 * replaces that placeholder. The actual drop is committed by the shell's
 * `handleDragEnd` — this cell only advertises the target.
 */
export const CellDisplay: TelescopeComponent<CellDisplayState> = function (
  props: TelescopedProps<CellDisplayState>,
): React.ReactElement {
  return RenderCellDisplay(useCellDisplayViewModel(props));
};

function RenderCellDisplay(
  viewModel: Readonly<CellDisplayViewModel>,
): React.ReactElement {
  const { gridRow, gridColumn, backgroundColor, pieceLabel, isOver } =
    viewModel;
  const isFilled = pieceLabel !== null;

  return (
    <Box
      ref={viewModel.droppableNodeRef}
      sx={{
        gridRow,
        gridColumn,
        backgroundColor,
        aspectRatio: "1",
        display: "grid",
        placeItems: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 0.5,
      }}
    >
      {isFilled ? (
        <Box
          role="img"
          aria-label={`Piece ${pieceLabel}, row ${gridRow}, column ${gridColumn}`}
          sx={{
            px: 0.5,
            py: 0.25,
            maxWidth: "90%",
            borderRadius: 0.5,
            backgroundColor: "common.black",
            opacity: 0.4,
          }}
        >
          <Typography variant="caption" sx={{ whiteSpace: "nowrap" }}>
            {pieceLabel}
          </Typography>
        </Box>
      ) : (
        // The §5.6 droppable target: a dashed "drop here" ring that turns solid while a
        // piece is dragged over the cell; the fit-count/tooltip extends it in Phase 12.
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
      )}
    </Box>
  );
}
