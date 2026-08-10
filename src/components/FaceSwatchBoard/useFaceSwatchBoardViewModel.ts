import { useMemo } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type {
  FaceSwatchBoardState,
  FaceSwatchBoardViewModel,
} from "./FaceSwatchBoard.types";
import { faceTileImageSrc } from "./useFaceSwatchBoardDomain";
import { useFaceSwatchBoardActions } from "./useFaceSwatchBoardActions";
import { useFaceSwatchBoardState } from "./useFaceSwatchBoardState";

/** Orchestrator: composes state + actions + domain-derived values. Wiring only. */
export function useFaceSwatchBoardViewModel(
  props: Readonly<TelescopedProps<FaceSwatchBoardState>>,
): FaceSwatchBoardViewModel {
  const state = useFaceSwatchBoardState(props);
  const actions = useFaceSwatchBoardActions(props);

  const trayTiles = useMemo(
    () =>
      props.state.trayTileIds.map((id) => ({
        id,
        imageSrc: faceTileImageSrc(id),
      })),
    [props.state.trayTileIds],
  );

  const slotTile = useMemo(
    () =>
      props.state.slotTileId === null
        ? null
        : {
            id: props.state.slotTileId,
            imageSrc: faceTileImageSrc(props.state.slotTileId),
          },
    [props.state.slotTileId],
  );

  return {
    trayTiles,
    slotTile,
    droppableRef: state.droppable.setNodeRef,
    isOver: state.droppable.isOver,
    canDropActive: state.canDropActive,
    onDragEnd: actions.onDragEnd,
    onReturnTile: actions.onReturnTile,
  };
}
