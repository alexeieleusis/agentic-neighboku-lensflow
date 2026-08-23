import type { Transform } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import type { Piece } from "../../game/entities";

/**
 * §5.6 — the pure tier of this component's fractal split (requirements §7.2.1): no
 * React runtime, no telescope imports (the `CSSProperties`/`Transform` imports are
 * type-only and erased at compile time). Owns the draggable-id convention
 * (`piece-{digits}`) the way the cell owns its `cell-{row}-{col}` one: this component
 * registers the id via `useDraggable`, and the shell's drag-end monitor needs the
 * inverse parse to read the dropped piece off a drag event.
 */

/**
 * The id a tray piece registers under via `useDraggable`: the piece's attribute digits
 * joined (e.g. `[1, 2, 0]` → `"piece-1-2-0"`). Every digit is a single character in the
 * supported bases (`base` ≤ 10), so the encoding is unambiguous for every tray piece.
 */
export function trayPieceDraggableId(piece: Piece): string {
  return `piece-${piece.join("-")}`;
}

/**
 * Inverse of {@link trayPieceDraggableId}: parse the draggable id back into the piece's
 * digits. Returns `null` for anything that is not exactly the encoded shape, so an
 * unrecognized `active.id` is a no-op drop instead of a crash.
 *
 * The result is a fresh digit array — deliberately NOT an interned `Piece` reference:
 * the move engine's `Map` lookups are by reference (§8.7), so resolving the parsed digits
 * back to the tray's own interned key is the shell's job (see `resolveTrayPiece` in
 * `src/useAppDomain.ts`).
 */
export function pieceFromDraggableId(id: string): readonly number[] | null {
  if (!id.startsWith("piece-")) return null;
  const digits = id.slice("piece-".length).split("-");
  const result: number[] = [];
  for (const digit of digits) {
    if (!/^\d+$/.test(digit)) return null;
    result.push(Number(digit));
  }
  return result;
}

/**
 * The inline style a tray piece carries through a drag: dnd-kit's `transform` while the
 * piece is being dragged (it follows the pointer), nothing while at rest, plus the
 * `touch-action: none` dnd-kit asks of every draggable node so the pointer sensor owns
 * the gesture instead of the browser scrolling it away.
 */
export function dragPieceStyle(
  transform: Transform | null,
  isDragging: boolean,
): CSSProperties {
  const style: CSSProperties = {
    touchAction: "none",
    cursor: isDragging ? "grabbing" : "grab",
  };
  if (transform !== null) {
    style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0)`;
  }
  if (isDragging) {
    style.zIndex = 1;
  }
  return style;
}
