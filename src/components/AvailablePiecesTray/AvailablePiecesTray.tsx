import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type {
  AvailablePiecesTrayColumn,
  AvailablePiecesTrayState,
  AvailablePiecesTrayViewModel,
} from "./AvailablePiecesTray.types";
import { useAvailablePiecesTrayViewModel } from "./useAvailablePiecesTrayViewModel";
import { PieceDisplay } from "../PieceDisplay/PieceDisplay";

/**
 * §5.5 — the available-pieces tray: one column per distinct remaining piece value,
 * sorted ascending by the piece's base-10-encoded value, each column showing the
 * piece image (via the shared Phase 6 `PieceDisplay`) and its remaining count. The
 * tray width scales with board size (`56px × size`). Deferred to Phase 13 regardless
 * of preference values: the `*` unique-cell hint and the per-cell click-to-place
 * button list. Deferred to Phase 8: drag-and-drop interactivity — the piece images
 * here are static.
 */
export const AvailablePiecesTray: TelescopeComponent<AvailablePiecesTrayState> =
  function (
    props: TelescopedProps<AvailablePiecesTrayState>,
  ): React.ReactElement {
    return RenderAvailablePiecesTray(useAvailablePiecesTrayViewModel(props));
  };

function RenderAvailablePiecesTray(
  viewModel: Readonly<AvailablePiecesTrayViewModel>,
): React.ReactElement {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" component="div">
        Piece tray
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        style={{ width: `${viewModel.widthPx}px` }}
        sx={{ flexWrap: "wrap", rowGap: 1 }}
      >
        {viewModel.columns.map((column) => (
          <TrayColumn key={column.piece.join("·")} column={column} />
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * One §5.5 tray column: the piece image (the shared Phase 6 `PieceDisplay`, fed by
 * this column's magnified piece-image telescope) and the remaining count. Renders no
 * `*` hint and no click-to-place buttons — both are Phase 13 scope, explicitly out of
 * scope here even when the corresponding preferences are on.
 */
function TrayColumn(
  props: Readonly<{ column: Readonly<AvailablePiecesTrayColumn> }>,
): React.ReactElement {
  const { column } = props;
  return (
    <Stack
      spacing={0.5}
      sx={{
        alignItems: "center",
        px: 1,
        py: 0.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 0.5,
      }}
    >
      <PieceDisplay {...column.pieceImage} />
      <Typography variant="caption">{column.count}</Typography>
    </Stack>
  );
}
