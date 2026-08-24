/**
 * The complete, self-describing state slice for the top-bar Undo control
 * (requirements §5.7): how many moves the shell has recorded. The button
 * renders nothing but an enabled/disabled icon, and enabled-ness is exactly
 * "at least one move placed" — so the move-history depth is this slice's only
 * load-bearing field.
 */
export interface UndoButtonState {
  readonly placedMoves: number;
}

/** Everything `RenderUndoButton` needs, precomputed by `useUndoButtonViewModel`. */
export interface UndoButtonViewModel {
  /**
   * §5.7 / §8.4: disabled if and only if no move has been placed yet. This UI
   * guard is the *only* empty-`placedCells` protection in the undo path —
   * Phase 3's `undoPlay` itself is unguarded by design.
   */
  readonly disabled: boolean;
  /**
   * Commits Phase 3's `undoPlay` through the magnified telescope: the write's
   * setter (the shell's undo lens) applies `undoPlay` to `game`, restoring the
   * tray count, blanking the cell, and recomputing both fit caches (§3.5).
   */
  readonly undo: () => void;
}
