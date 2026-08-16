import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { DndKitDroppable } from "../../base/DndKitInterfaces";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import {
  createFaceTileId,
  type FaceSwatchBoardState as BoardState,
} from "./FaceSwatchBoard.types";
import { canDropTile, SLOT_DROPPABLE_ID } from "./useFaceSwatchBoardDomain";

export interface FaceSwatchBoardStateInternal {
  readonly droppable: DndKitDroppable;
  readonly canDropActive: boolean;
}

export function useFaceSwatchBoardState(
  props: Readonly<TelescopedProps<BoardState>>,
): FaceSwatchBoardStateInternal {
  const droppable: DndKitDroppable = useDroppable({ id: SLOT_DROPPABLE_ID });

  // dnd-kit already tracks the active drag on every droppable registered in the
  // DndContext — no need for a parallel activeDragId state synced via onDragStart.
  const canDropActive = useMemo(() => {
    const activeDragId = droppable.active ? String(droppable.active.id) : null;
    return (
      activeDragId !== null &&
      canDropTile(props.state, createFaceTileId(activeDragId))
    );
  }, [droppable.active, props.state]);

  return { droppable, canDropActive };
}
