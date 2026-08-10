import type { DragEndEvent } from "@dnd-kit/core";

export interface FaceSwatchBoardState {
  readonly trayTileIds: ReadonlyArray<string>;
  readonly slotTileId: string | null;
}

export interface FaceTile {
  readonly id: string;
  readonly imageSrc: string;
}

export interface FaceSwatchBoardViewModel {
  readonly trayTiles: ReadonlyArray<FaceTile>;
  readonly slotTile: FaceTile | null;
  readonly droppableRef: (element: HTMLElement | null) => void;
  readonly isOver: boolean;
  readonly canDropActive: boolean;
  readonly onDragEnd: (event: DragEndEvent) => void;
  readonly onReturnTile: () => void;
}
