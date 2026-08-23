import Box from "@mui/material/Box";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type {
  DraggablePieceState,
  DraggablePieceViewModel,
} from "./DraggablePiece.types";
import { useDraggablePieceViewModel } from "./useDraggablePieceViewModel";
import { PieceDisplay } from "../PieceDisplay/PieceDisplay";

/**
 * §5.6 — a draggable piece in the available-pieces tray. `state,telescope →
 * useDraggablePieceViewModel → RenderDraggablePiece` (requirements §7.2): the piece
 * image renders via the shared Phase 6 `PieceDisplay` (fed by a magnified piece-image
 * slice), and the whole element is the dnd-kit draggable node — root element gets the
 * node ref, the pointer listeners, and the ARIA attributes dnd-kit hands out. The
 * `useDraggable` registration only works because this component renders inside the
 * shell-level shared `DndContext` that `App` constructs (docs/CONVENTIONS.md dnd-kit
 * note); dropping it onto a blank board cell is committed by the shell's `handleDragEnd`
 * (Phase 13's click-to-place will share the same `placePiece` path).
 */
export const DraggablePiece: TelescopeComponent<DraggablePieceState> =
  function (props: TelescopedProps<DraggablePieceState>): React.ReactElement {
    return RenderDraggablePiece(useDraggablePieceViewModel(props));
  };

function RenderDraggablePiece(
  viewModel: Readonly<DraggablePieceViewModel>,
): React.ReactElement {
  return (
    <Box
      ref={viewModel.dragNodeRef}
      {...viewModel.listeners}
      {...viewModel.attributes}
      style={viewModel.dragStyle}
      sx={{ display: "grid", placeItems: "center" }}
    >
      <PieceDisplay {...viewModel.pieceImage} />
    </Box>
  );
}
