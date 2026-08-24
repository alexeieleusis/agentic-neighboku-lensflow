import type { Cell } from "../../game/gameBuilder";

/**
 * §5.6 — the pure tier of this cell's fractal split (requirements §7.2.1): no React, no
 * telescope imports. Owns the droppable-id convention (`cell-{row}-{col}`) both because
 * this cell is where the id is registered via `useDroppable` and because the shell's
 * drag-end monitor needs the inverse parse to read the target cell off a drag event.
 */

/**
 * The §5.6 droppable id of the cell at `(row, col)` — 0-indexed, the same row/column
 * addressing every other board-level structure in this build uses.
 */
export function cellDroppableId(row: number, col: number): string {
  return `cell-${row}-${col}`;
}

/**
 * Inverse of {@link cellDroppableId}: parse `cell-{row}-{col}` back into a `Cell`.
 * Returns `null` for anything that is not exactly the §5.6 cell shape, so the
 * drag-end monitor treats a non-cell drop target as a no-op instead of a crash.
 */
export function cellFromDroppableId(id: string): Cell | null {
  const match = /^cell-(\d+)-(\d+)$/.exec(id);
  if (match === null) return null;
  return [Number(match[1]), Number(match[2])];
}
