import { useDraggable } from "@dnd-kit/core";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";
import type { DraggablePieceViewModel } from "./DraggablePiece.types";
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
 *
 * The tray's piece-image slice is already `PieceDisplayState`, so the wrapped
 * `PieceDisplay` receives it unchanged — there is no intermediate state to re-magnify.
 */
export function useDraggablePieceViewModel(
  props: Readonly<TelescopedProps<PieceDisplayState>>,
): DraggablePieceViewModel {
  const { piece } = props.state;
  const draggable = useDraggable({ id: trayPieceDraggableId(piece) });

  return {
    pieceImage: props,
    dragNodeRef: draggable.setNodeRef,
    listeners: draggable.listeners,
    attributes: draggable.attributes,
    isDragging: draggable.isDragging,
    dragStyle: dragPieceStyle(draggable.transform, draggable.isDragging),
  };
}
