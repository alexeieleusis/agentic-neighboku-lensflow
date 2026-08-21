import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type {
  BoardDisplayState,
  BoardDisplayViewModel,
} from "./BoardDisplay.types";
import { useBoardDisplayViewModel } from "./useBoardDisplayViewModel";
import { RowDisplay } from "../RowDisplay/RowDisplay";

/**
 * §5.2 — the board, as a CSS grid with exactly one row and one column per board
 * row/column. Each `CellDisplay` positions itself with its view model's
 * `gridRow`/`gridColumn` and paints its section-keyed `backgroundColor` (sections are
 * the §3.3 `sectionSize × sectionSize` sub-grid tiling, so section membership is
 * visually legible). Out of scope this phase, per the Phase 5 note: no
 * `hintFitPieceCount`/`showFitPiecesOnHover` logic (Phase 12) and no shared
 * piece-rendering component yet (Phase 6) — filled cells show a minimal placeholder.
 */
export const BoardDisplay: TelescopeComponent<BoardDisplayState> = function (
  props: TelescopedProps<BoardDisplayState>,
): React.ReactElement {
  return RenderBoardDisplay(useBoardDisplayViewModel(props));
};

function RenderBoardDisplay(
  viewModel: Readonly<BoardDisplayViewModel>,
): React.ReactElement {
  const { size, rows } = viewModel;

  return (
    <Box>
      <Typography variant="subtitle2" component="div" sx={{ mb: 1 }}>
        Board ({size}×{size})
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, auto)`,
          gap: "0.25rem",
        }}
      >
        {rows.map((row) => (
          <RowDisplay key={row.state.rowIndex} {...row} />
        ))}
      </Box>
    </Box>
  );
}
