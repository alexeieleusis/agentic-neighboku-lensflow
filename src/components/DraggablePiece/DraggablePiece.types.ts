import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { CSSProperties } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { Piece } from "../../game/entities";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";

/**
 * §5.6 — the complete, self-describing state slice for one draggable tray piece: the
 * piece value (its attribute digits) and the pixel size its image is rendered at.
 * Structurally identical to `PieceDisplayState` on purpose — the tray magnifies one such
 * slice per column and hands it here, and this component in turn hands a piece-image
 * slice to the `PieceDisplay` it renders.
 */
export interface DraggablePieceState {
  readonly piece: Piece;
  readonly size: number;
}

/**
 * Everything `RenderDraggablePiece` needs, precomputed by `useDraggablePieceViewModel`.
 * `pieceImage` is the §7.2 load-bearing parent→child flow: a magnified-telescope slice
 * for the wrapped `PieceDisplay`. The rest is the `useDraggable` registration surface —
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
