import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type { Cell } from "../../game/gameBuilder";
import type { Piece } from "../../game/entities";
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
 * from here and dropped on the board under the shared shell-level `DndContext`), its
 * remaining count, the §5.5 second-bullet `*` hint (a piece's placement is now forced),
 * and — when the `pieceCells` hint is on — the §5.5 third-bullet click-to-place button
 * list: one button per legal fit-cell, labeled with the 1-indexed `row,column`, that
 * places the piece there through the same `placePiece` path the drag-and-drop uses.
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
          <TrayColumn
            key={column.piece.join("·")}
            column={column}
            onPlacePiece={viewModel.onPlacePiece}
          />
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * One §5.5 tray column: the draggable piece image, the remaining count (with the
 * §5.5 second-bullet `*` appended when the piece's placement is forced), and — when
 * the `pieceCells` hint is on — the §5.5 third-bullet click-to-place buttons, one per
 * legal fit-cell, each committing its `(piece, cell)` placement through the shared
 * action handler.
 */
function TrayColumn(
  props: Readonly<{
    readonly column: Readonly<AvailablePiecesTrayColumn>;
    readonly onPlacePiece: (piece: Piece, cell: Cell) => void;
  }>,
): React.ReactElement {
  const { column, onPlacePiece } = props;
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
      <Typography variant="caption">
        {column.count}
        {column.forcedPlacement ? "*" : ""}
      </Typography>
      {column.placements.length > 0 && (
        <Stack spacing={0.5}>
          {column.placements.map((placement) => (
            <Button
              key={placement.label}
              size="small"
              onClick={() => onPlacePiece(column.piece, placement.cell)}
            >
              {placement.label}
            </Button>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
