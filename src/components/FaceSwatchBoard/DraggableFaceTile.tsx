import type { CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { DndKitDraggable } from "../../base/DndKitInterfaces";

export interface DraggableFaceTileProps {
  readonly id: string;
  readonly imageSrc: string;
}

/**
 * A pure, non-telescoped presentational leaf — like the original codebase's PieceDisplay,
 * not every child needs to be a TelescopeComponent. This one owns no state worth lensing
 * into; it just needs dnd-kit's per-element useDraggable hook, which requires its own
 * component instance (dnd-kit hooks can't be called a variable number of times inside a
 * parent's render loop).
 */
export function DraggableFaceTile(
  props: Readonly<DraggableFaceTileProps>,
): React.ReactElement {
  const draggable: DndKitDraggable = useDraggable({ id: props.id });

  const style = {
    cursor: "grab",
    touchAction: "none",
    ...(draggable.transform
      ? {
          transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`,
          zIndex: draggable.isDragging ? 1 : undefined,
        }
      : {}),
  } satisfies CSSProperties;

  return (
    <img
      ref={draggable.setNodeRef}
      src={props.imageSrc}
      alt={props.id}
      width={56}
      height={56}
      style={style}
      {...draggable.listeners}
      {...draggable.attributes}
    />
  );
}
