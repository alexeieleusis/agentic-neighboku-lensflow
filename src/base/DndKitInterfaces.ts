import type { Active, DraggableAttributes, Over } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { MutableRefObject } from "react";
import type { Transform } from "@dnd-kit/utilities";
import type { ClientRect } from "@dnd-kit/core";

export interface DndKitDroppable {
  active: Active | null;
  rect: MutableRefObject<ClientRect | null>;
  isOver: boolean;
  node: MutableRefObject<HTMLElement | null>;
  over: Over | null;
  setNodeRef: (element: HTMLElement | null) => void;
}

export interface DndKitDraggable {
  active: Active | null;
  activatorEvent: Event | null;
  activeNodeRect: ClientRect | null;
  attributes: DraggableAttributes;
  isDragging: boolean;
  listeners: SyntheticListenerMap | undefined;
  node: MutableRefObject<HTMLElement | null>;
  over: Over | null;
  setNodeRef: (element: HTMLElement | null) => void;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  transform: Transform | null;
}
