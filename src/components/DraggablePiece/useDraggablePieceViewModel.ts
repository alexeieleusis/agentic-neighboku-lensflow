import { useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Lens } from "telescopejs";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";
import type {
  DraggablePieceState,
  DraggablePieceViewModel,
} from "./DraggablePiece.types";
import {
  dragPieceStyle,
  trayPieceDraggableId,
} from "./useDraggablePieceDomain";

/**
 * Orchestrator (requirements §7.2.1): registers the dnd-kit draggable and composes the
 * view model, wiring-only. There is no local non-telescope UI state and no
 * user-triggered action of its own — dnd-kit owns the pointer gesture, and the actual
 * drop is committed centrally by the shell's `handleDragEnd` (`src/useAppActions.ts`) —
 * so no State/Actions split; the only tier split warranted is the pure id/style tier in
 * `useDraggablePieceDomain`.
 *
 * `useDraggable` registers with the nearest ancestor `DndContext` via React context
 * (docs/CONVENTIONS.md dnd-kit note), which this component always has: the tray renders
 * it under the shell-level `<DndContext>` that `App` constructs.
 */
export function useDraggablePieceViewModel(
  props: Readonly<TelescopedProps<DraggablePieceState>>,
): DraggablePieceViewModel {
  const { piece, size } = props.state;
  const draggable = useDraggable({ id: trayPieceDraggableId(piece) });

  const pieceImage = useMemo<TelescopedProps<PieceDisplayState>>(
    () => ({
      state: { piece, size },
      telescope: props.telescope.magnify(PIECE_IMAGE_LENS),
    }),
    [piece, size, props.telescope],
  );

  return {
    pieceImage,
    dragNodeRef: draggable.setNodeRef,
    listeners: draggable.listeners,
    attributes: draggable.attributes,
    isDragging: draggable.isDragging,
    dragStyle: dragPieceStyle(draggable.transform, draggable.isDragging),
  };
}

/**
 * The magnification focusing the draggable-piece telescope down to the piece image it
 * renders. Same deliberate asymmetry as the read-only board/tray slices in
 * `src/useAppViewModel.ts`: the piece value and the render size are immutable facts for
 * the lifetime of this column, so writes through the slice are the identity no-op and
 * the magnified stream simply mirrors.
 */
const PIECE_IMAGE_LENS = new Lens<DraggablePieceState, PieceDisplayState>(
  (state) => ({ piece: state.piece, size: state.size }),
  (_pieceImage, state) => state,
);
