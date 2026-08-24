import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { CSSProperties } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";

/**
 * Everything `RenderDraggablePiece` needs, precomputed by `useDraggablePieceViewModel`.
 * `pieceImage` is the §7.2 load-bearing parent→child flow: the magnified piece-image
 * slice (`PieceDisplayState`) the tray hands down, re-exported here unchanged for the
 * wrapped `PieceDisplay`. The rest is the `useDraggable` registration surface —
 * the node ref to attach, the pointer listeners and ARIA attributes to spread onto the
 * root element, and the in-drag transform style.
 */
export interface DraggablePieceViewModel {
  readonly pieceImage: TelescopedProps<PieceDisplayState>;
  readonly dragNodeRef: (element: HTMLElement | null) => void;
  readonly listeners: SyntheticListenerMap | undefined;
  readonly attributes: DraggableAttributes;
  readonly isDragging: boolean;
  readonly dragStyle: CSSProperties;
}
