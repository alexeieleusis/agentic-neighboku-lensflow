import type { FaceSwatchBoardState, FaceTileId } from "./FaceSwatchBoard.types";

/**
 * Non-trivial tier (requirements.md §7.2.1): pure functions only, no React or telescope
 * imports. This is the highest-priority tier of the testing pyramid (requirements.md §7.5)
 * — see __tests__/useFaceSwatchBoardDomain.test.ts.
 */

export const SLOT_DROPPABLE_ID = "face-swatch-board-slot";

export function canDropTile(
  state: FaceSwatchBoardState,
  tileId: FaceTileId,
): boolean {
  return state.slotTileId === null && state.trayTileIds.includes(tileId);
}

export function dropTile(
  state: FaceSwatchBoardState,
  tileId: FaceTileId,
): FaceSwatchBoardState {
  if (!canDropTile(state, tileId)) {
    return state;
  }
  return {
    trayTileIds: state.trayTileIds.filter((id) => id !== tileId),
    slotTileId: tileId,
  };
}

export function returnSlotTile(
  state: FaceSwatchBoardState,
): FaceSwatchBoardState {
  if (state.slotTileId === null) {
    return state;
  }
  return {
    trayTileIds: [...state.trayTileIds, state.slotTileId],
    slotTileId: null,
  };
}

export function faceTileImageSrc(tileId: FaceTileId): string {
  return `/faces/${tileId}.png`;
}
