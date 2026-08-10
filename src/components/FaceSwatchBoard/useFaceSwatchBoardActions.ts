import { useCallback } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { FaceSwatchBoardState } from "./FaceSwatchBoard.types";
import {
  dropTile,
  returnSlotTile,
  SLOT_DROPPABLE_ID,
} from "./useFaceSwatchBoardDomain";

export interface FaceSwatchBoardActions {
  readonly onDragEnd: (event: DragEndEvent) => void;
  readonly onReturnTile: () => void;
}

/**
 * Event-handler closures only. Each action curries a useFaceSwatchBoardDomain function
 * with current state/telescope, then commits via telescope.update — no business logic
 * lives directly in an action body.
 */
export function useFaceSwatchBoardActions(
  props: Readonly<TelescopedProps<FaceSwatchBoardState>>,
): FaceSwatchBoardActions {
  const { telescope } = props;

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.over?.id === SLOT_DROPPABLE_ID) {
        telescope.update(dropTile(props.state, String(event.active.id)));
      }
    },
    [telescope, props.state],
  );

  const onReturnTile = useCallback(() => {
    telescope.update(returnSlotTile(props.state));
  }, [telescope, props.state]);

  return { onDragEnd, onReturnTile };
}
