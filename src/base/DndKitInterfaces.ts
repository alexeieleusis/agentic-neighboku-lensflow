import type {
  Active,
  ClientRect,
  DraggableAttributes,
  Over,
} from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { Transform } from "@dnd-kit/utilities";

export interface DndKitDroppable {
  readonly active: Active | null;
  readonly rect: { current: ClientRect | null };
  readonly isOver: boolean;
  readonly node: { current: HTMLElement | null };
  readonly over: Over | null;
  readonly setNodeRef: (element: HTMLElement | null) => void;
}

export interface DraggableState {
  readonly active: Active | null;
  readonly activatorEvent: Event | null;
  readonly activeNodeRect: ClientRect | null;
  readonly over: Over | null;
  readonly isDragging: boolean;
}

export interface DraggableRefs {
  readonly node: { current: HTMLElement | null };
  readonly setNodeRef: (element: HTMLElement | null) => void;
  readonly setActivatorNodeRef: (element: HTMLElement | null) => void;
}

export interface DraggableRender {
  readonly attributes: DraggableAttributes;
  readonly listeners: SyntheticListenerMap | undefined;
  readonly transform: Transform | null;
}

export type DndKitDraggable = DraggableState & DraggableRefs & DraggableRender;
