import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { closestCenter, DndContext, useDndMonitor } from "@dnd-kit/core";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type {
  FaceSwatchBoardState,
  FaceSwatchBoardViewModel,
} from "./FaceSwatchBoard.types";
import { useFaceSwatchBoardViewModel } from "./useFaceSwatchBoardViewModel";
import { DraggableFaceTile } from "./DraggableFaceTile";

/**
 * The outer component only sets up DndContext — it must NOT call
 * useFaceSwatchBoardViewModel (or any hook that calls useDroppable/useDraggable/
 * useDndMonitor) itself. Those hooks register with the nearest ANCESTOR DndContext via
 * React context, so they only work correctly when called from a component rendered
 * INSIDE <DndContext>, not from the component that constructs the <DndContext> element.
 * (This was the actual cause of a real bug here: the drop slot never registered because
 * useDroppable was originally called in this same function, above the <DndContext>
 * return — collision detection silently had zero droppables to check against.)
 */
export const FaceSwatchBoard: TelescopeComponent<FaceSwatchBoardState> =
  function (props: TelescopedProps<FaceSwatchBoardState>): React.ReactElement {
    return (
      <DndContext collisionDetection={closestCenter}>
        <FaceSwatchBoardConnected {...props} />
      </DndContext>
    );
  };

function FaceSwatchBoardConnected(
  props: TelescopedProps<FaceSwatchBoardState>,
): React.ReactElement {
  const viewModel = useFaceSwatchBoardViewModel(props);
  useDndMonitor({ onDragEnd: viewModel.onDragEnd });
  return RenderFaceSwatchBoard(viewModel);
}

function RenderFaceSwatchBoard(
  viewModel: Readonly<FaceSwatchBoardViewModel>,
): React.ReactElement {
  const dropStatus = !viewModel.isOver
    ? null
    : viewModel.canDropActive
      ? "success"
      : "error";

  return (
    <Stack direction="row" spacing={4} sx={{ alignItems: "flex-start" }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Tray</Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          {viewModel.trayTiles.map((tile) => (
            <DraggableFaceTile
              key={tile.id}
              id={tile.id}
              imageSrc={tile.imageSrc}
            />
          ))}
        </Stack>
      </Stack>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Slot</Typography>
        <Box
          ref={viewModel.droppableRef}
          sx={{
            width: 96,
            height: 96,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: dropStatus ? "3px solid" : "2px dashed",
            borderColor: dropStatus ? `${dropStatus}.main` : "divider",
            borderRadius: 1,
            backgroundColor: dropStatus ? `${dropStatus}.dark` : "transparent",
            transition: "background-color 100ms, border-color 100ms",
          }}
        >
          {viewModel.slotTile ? (
            <img
              src={viewModel.slotTile.imageSrc}
              alt={viewModel.slotTile.id}
              width={56}
              height={56}
            />
          ) : viewModel.isOver ? (
            <Typography variant="caption" sx={{ color: "common.white" }}>
              Drop!
            </Typography>
          ) : null}
        </Box>
        {viewModel.slotTile ? (
          <Button size="small" onClick={viewModel.onReturnTile}>
            Return to tray
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
