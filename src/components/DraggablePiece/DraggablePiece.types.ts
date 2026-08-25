import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { CSSProperties } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";

/**
 * §5.6 — the drag-fit hint's four-state machine. Defined here, at the tray piece,
 * because the piece is the value's source of truth: a drag only ever concerns the
 * tray piece being dragged. The value lives on a `dragHint` slice of the shell
 * state (`AppState`) and is communicated up to the top-bar icon through a dedicated
 * magnified telescope (Phase 14) — never through component props or callbacks.
 *
 * The state machine (the shell's drag-lifecycle monitor computes it, §5.6):
 *   - `"None"`    — no drag is in progress (before drag-start; immediately after
 *                   drag-end or drag-cancel).
 *   - `"Unknown"` — a drag is in progress, but the hint cannot be determined: the
 *                   pointer hovers no registered droppable target, or
 *                   `preferences.hints.fitOnDrag` is off (Ok/NotOk are only ever
 *                   produced while that preference is on AND the piece is over a
 *                   droppable target).
 *   - `"Ok"`      — the piece is over a droppable target that is a legal placement
 *                   for it (per the move engine's `pieceToFitCells` cache).
 *   - `"NotOk"`   — the piece is over a droppable target that is not a legal
 *                   placement for it.
 *
 * The top-bar icon renders exactly three visual states from these four values:
 * the info icon for `"None"`/`"Unknown"`, the thumbs-up for `"Ok"`, the thumbs-down
 * for `"NotOk"`.
 */
export type DragHint = "None" | "Unknown" | "Ok" | "NotOk";

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
