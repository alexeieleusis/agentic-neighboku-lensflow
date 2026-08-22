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
 * §5.2 — one board cell. It positions itself on the board grid with its view model's
 * `gridRow`/`gridColumn` and paints its section-keyed `backgroundColor`. A blank cell
 * shows its `pieceType`-appropriate droppable target — a placeholder in this phase;
 * the Phase 8 drag target and the Phase 12 fit hints land here. A filled cell shows
 * a minimal inline placeholder for its piece; the shared `PieceDisplay` (Phases 6–19)
 * replaces that placeholder.
 */
export const CellDisplay: TelescopeComponent<CellDisplayState> = function (
  props: TelescopedProps<CellDisplayState>,
): React.ReactElement {
  return RenderCellDisplay(useCellDisplayViewModel(props));
};

function RenderCellDisplay(
  viewModel: Readonly<CellDisplayViewModel>,
): React.ReactElement {
  const { gridRow, gridColumn, backgroundColor, pieceLabel } = viewModel;
  const isFilled = pieceLabel !== null;

  return (
    <Box
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
        // Blank-cell droppable target placeholder: a dashed "drop here" ring. The
        // real drag target lands in Phase 8 and the fit-count/tooltip in Phase 12.
        <Box
          aria-hidden
          sx={{
            width: "60%",
            height: "60%",
            border: "1px dashed",
            borderColor: "text.disabled",
            borderRadius: 0.5,
          }}
        />
      )}
    </Box>
  );
}
