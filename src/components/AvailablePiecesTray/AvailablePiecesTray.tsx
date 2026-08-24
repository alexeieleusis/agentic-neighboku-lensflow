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
import { DraggablePiece } from "../DraggablePiece/DraggablePiece";

/**
 * §5.5 + §5.6 — the available-pieces tray: one column per distinct remaining piece
 * value, sorted ascending by the piece's base-10-encoded value, each column showing
 * the draggable piece image (the Phase 8 `DraggablePiece` wrapping the shared Phase 6
 * `PieceDisplay`: the image is the `useDraggable` node, so a piece can be picked up
 * from here and dropped on the board under the shared shell-level `DndContext`) and
 * its remaining count.
 * The tray spans the width of the board above it, so a column wraps to the next
 * row only when the next column would not fit in that width. Deferred to Phase 13
 * regardless of preference values: the `*` unique-cell hint and the
 * click-to-place button list. Mobile/touch sensor tuning lands in Phase 9.
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
        style={{ width: "100%" }}
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
 * One §5.5 tray column: the draggable piece image (the Phase 8 `DraggablePiece`, fed
 * by this column's magnified piece-image telescope — it renders the shared Phase 6
 * `PieceDisplay` as its drag node) and the remaining count. Renders no `*` hint and no
 * click-to-place buttons — both are Phase 13 scope, explicitly out of scope here even
 * when the corresponding preferences are on.
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
      <DraggablePiece {...column.pieceImage} />
      <Typography variant="caption">{column.count}</Typography>
    </Stack>
  );
}
