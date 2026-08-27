/**
 * §5.9/§4.1 — the state slice this component reads and commits through: the
 * shell's §4.2 `scalars` (`size`/`dimension`/`base` — the board builder's
 * inputs, mirrored from `AppState.preferences.scalars`) plus the shell's
 * §5.13/§5.9 game clock origin (`gamePlay.startTime`), which the Start commit
 * replaces with a fresh timestamp. The component's props are
 * `TelescopedProps<NewGamePanelState>`: the snapshot plus the App →
 * `NewGamePanel` magnified telescope (the `NEW_GAME_PANEL_LENS` in
 * `useAppViewModel.ts`) — the panel's one write path, the Start commit
 * (§5.9), whose setter rebuilds the board and closes the drawer.
 */
export interface NewGamePanelState {
  /** §4.2: the board size the shell's current game was built with. */
  readonly size: number;
  /** §4.2: the piece dimension the shell's current game was built with. */
  readonly dimension: number;
  /** §4.2: the piece base — carried through the Start commit, never changed by the panel. */
  readonly base: number;
  /** §5.13/§5.9: the game clock origin (epoch ms) — the value Start replaces. */
  readonly startTime: number;
}

/**
 * §4.1/§5.9 — the pending board-size selection the panel holds LOCALLY
 * between first open and Start: the size the select shows, plus the dimension
 * the §4.1 size rule computes for it. `base` is deliberately absent: the size
 * selector never changes it, so it is not part of the selection.
 */
export interface NewGamePanelSelection {
  readonly size: number;
  readonly dimension: number;
}

/** Everything `RenderNewGamePanel` needs, precomputed by `useNewGamePanelViewModel`. */
export interface NewGamePanelViewModel {
  /**
   * §4.1's six selectable board sizes, in select order: 4, 6, 8, 9, 12, 16 —
   * no more and no fewer.
   */
  readonly sizes: readonly number[];
  /**
   * The Board Size select's current value: the panel's LOCAL selection
   * (§5.9's first-open default of 8×8, moved only by the select), not the
   * shell's current `scalars.size`.
   */
  readonly selectedSize: number;
  /**
   * The select's change handler: applies §4.1's size→dimension rule to the
   * panel's local selection (`size >= 8` forces the dimension to 3;
   * `size < 8` leaves it unchanged). A local UI-state move — no telescope
   * write happens until Start.
   */
  readonly onSizeChange: (size: number) => void;
  /**
   * The Start button's commit (§5.9): rebuilds the board from the selected
   * scalars, unfolds a fresh puzzle, resets `gamePlay.startTime`, and closes
   * the panel — one commit through the slice's magnified telescope.
   */
  readonly onStart: () => void;
}
