import type { TelescopedProps } from "./base/TelescopeComponent.ts";
import type { Game } from "./game/gameBuilder.ts";
import type { PieceType } from "./components/CellDisplay/CellDisplay.types.ts";
import type { BoardDisplayState } from "./components/BoardDisplay/BoardDisplay.types.ts";
import type { AvailablePiecesTrayState } from "./components/AvailablePiecesTray/AvailablePiecesTray.types.ts";
import type { DragHint } from "./components/DraggablePiece/DraggablePiece.types.ts";
import type { SolvabilityIconState } from "./components/SolvabilityIcon/SolvabilityIcon.types.ts";
import type { NewGamePanelState } from "./components/NewGamePanel/NewGamePanel.types.ts";
import type { HelpPanelState } from "./components/HelpPanel/HelpPanel.types.ts";

/**
 * The two visual skins for the shared attribute space (requirements §1, §5.4). A user
 * preference toggled via the Preferences panel (Phase 16); the actual Shapes/Faces
 * rendering is Phase 6/Phase 19. The type itself is defined at the Phase 5 leaf
 * (`CellDisplay.types.ts`, its first consumer) and imported here bottom-up so the
 * component type graph stays acyclic.
 */
export type { PieceType } from "./components/CellDisplay/CellDisplay.types.ts";

/** The §4.2 scalar sub-object of the wide preferences. */
export interface PreferenceScalars {
  readonly base: number;
  readonly dimension: number;
  readonly size: number;
}

/**
 * §4.2 hint toggles for the “does it fit” preview. Independent user preferences
 * (defaults enable several at once — see `defaultPreferences` in `main.tsx`), not
 * mutually exclusive states — so they stay parallel booleans rather than a
 * discriminated union (UC13 “When Not to Use It”: independent simple flags).
 */
// eslint-disable-next-line lensflow/no-parallel-boolean-state-flags
export interface FitHintFlags {
  readonly fitPieceCount: boolean;
  readonly pieceCells: boolean;
  readonly fitOnDrag: boolean;
  readonly showFitPiecesOnHover: boolean;
}

/** §4.2 hint toggles for the available-pieces tray. */
export interface AvailableHintFlags {
  readonly availablePiecesCount: boolean;
  readonly availablePieceUniqueCell: boolean;
}

/** §4.2 hint toggle for the solvability indicator. */
export interface SolvabilityHintFlag {
  readonly gameIsSolvable: boolean;
}

/** §4.2 hint toggles, nested under `AppPreferences`'s single `hints` member. */
export type HintPreferences = FitHintFlags &
  AvailableHintFlags &
  SolvabilityHintFlag;

/**
 * The wide, user-facing preferences (requirements §4.2). Distinct from the domain
 * `Game`'s narrow `GamePreferences` (which only carries `preventInvalidMoves`): the
 * move-engine reads a subset, the app owns the full set that is persisted (Phase 16).
 */
export interface AppPreferences {
  readonly scalars: PreferenceScalars;
  readonly pieceType: PieceType;
  readonly hints: HintPreferences;
  readonly preventInvalidMoves: boolean;
  readonly sound: boolean;
}

/**
 * §5.13 / §5.9 — the in-flight game's clock: when the current game started, in
 * epoch milliseconds. The shell owns it (the move engine stays time-free, §7.4): it
 * is stamped once at shell init (`main.tsx`) and — once the New Game panel ships
 * (Phase 17) — reset when a fresh game starts. The finished-game Dialog's elapsed
 * string (§5.13) is the difference between `Date.now()` at the tray-emptying
 * moment (Phase 15's one-time capture in the state tier) and this value.
 */
export interface GamePlayState {
  readonly startTime: number;
}

/**
 * Root shell state (requirements §5.1, §7.3). `game` is the Phase 1–3 move-engine `Game`;
 * everything else is app-shell-owned and is never persisted (only `preferences` is, later).
 */
export interface AppState {
  /** A real, freshly-unfolded Phase 3 `Game` produced by `buildBoard` + `unfoldGame`. */
  readonly game: Game;
  readonly preferences: AppPreferences;
  /** §5.13/§5.9: when the current game started (epoch ms); the elapsed duration's origin. */
  readonly gamePlay: GamePlayState;
  /**
   * §5.12 invalid-move feedback (Phase 11): closed by default; the drag-end path opens
   * it when a placement is rejected (`placePiece` throw, §3.5), and dismissal (6-second
   * auto-hide or manual close) writes it back closed through the action tier.
   */
  readonly invalidMoveSnackbarOpen: boolean;
  /**
   * §5.6 (Phase 14): the drag-fit hint's current value — `"None"` whenever no drag
   * is in progress, updated by the shell's drag-lifecycle monitor (`useAppActions`)
   * as drag state changes. This is its own slice of shell state: the monitor's
   * write and the App → `DragFitHintIcon` top-bar read each flow through an
   * independent magnified telescope onto it (the dedicated `DRAG_HINT_LENS`),
   * never through component props/callbacks, and never piggybacked on the
   * board/tray slices.
   */
  readonly dragHint: DragHint;
  /**
   * §5.9 (Phase 17): the New Game drawer's open state — shell-owned `AppState`,
   * like `invalidMoveSnackbarOpen`, deliberately NOT the shell's local UI state
   * (the way the Phase 16 preferences drawer's flag is in `useAppState`): the
   * panel's Start commit closes the drawer (§5.9 "and closes the panel")
   * through the App → `NewGamePanel` magnified telescope, and the drawer's own
   * dismissal (backdrop click / Escape) closes it through the shell telescope —
   * both are `AppState` writes, so the flag the two share must live on
   * `AppState`, where a telescope write can reach it.
   */
  readonly newGameDrawerOpen: boolean;
}

/* -------------------------------------------------------------------------- */
/* View-model shapes consumed by RenderApp                                     */
/* -------------------------------------------------------------------------- */

/** Everything `RenderApp` needs, precomputed by `useAppViewModel`. */
export interface AppViewModel {
  /**
   * The Phase 5 board slice: `BoardDisplayState` plus a magnified child telescope
   * (`App` → `BoardDisplay`, §7.2). Read-only projection of `game.board`: placement
   * (Phase 8 drag-drop, §5.6) commits through the move engine and rebuilds `game`
   * wholesale on the shell telescope — writes never flow through this slice itself.
   */
  readonly board: TelescopedProps<BoardDisplayState>;
  /**
   * The Phase 7 tray slice: `AvailablePiecesTrayState` plus a magnified child
   * telescope (`App` → `AvailablePiecesTray`, §7.2). Read-only projection of
   * `game.availablePieces`, for the same reason as the board slice: the move engine
   * owns the tray, and this slice mirrors it as `game` is rebuilt.
   */
  readonly tray: TelescopedProps<AvailablePiecesTrayState>;
  /**
   * The Phase 14 top-bar slice: the shell's current `DragHint` plus a magnified child
   * telescope (`App` → `DragFitHintIcon`, §7.2) — the READ side of the §5.6 dedicated
   * hint channel. Read-only from the icon's point of view: the writes land on the same
   * `dragHint` slice through the shell's drag-lifecycle monitor's own independent
   * magnification, and the slice mirrors it as shell state changes.
   */
  readonly dragHint: TelescopedProps<DragHint>;
  /**
   * §5.13 / Phase 15: the App → `SolvabilityIcon` magnification (§7.2) onto the
   * §5.13 solvability-indicator state — the §4.2 `hints.gameIsSolvable`
   * preference plus Phase 3's `stateIsValid` result on `game`. Read-only from the
   * icon's point of view (its lens setter is the identity): both values are derived
   * upstream, in the shell, and this slice mirrors them as shell state changes.
   */
  readonly solvability: TelescopedProps<SolvabilityIconState>;
  /**
   * §5.8 / Phase 16: the App → `PreferencesDisplay` magnification (§7.2) onto the
   * shell's §4.2 `preferences` slice. Unlike the board/tray/solvability slices,
   * this one is read-AND-write from the panel's point of view: the drawer's 9
   * controls each read their own value off the slice's `state` and commit their
   * changes back through the slice's telescope (the `PREFERENCES_LENS` setter in
   * `useAppViewModel.ts` replaces `AppState.preferences` wholesale), so every
   * toggle reaches the shell — and `main.tsx`'s per-emission persistence (§4.3) —
   * without any prop-drilled callback.
   */
  readonly preferences: TelescopedProps<AppPreferences>;
  /**
   * §5.10 / Phase 18: the App → `HelpPanel` magnification (§7.2) onto the current
   * candidate space's `{ base, dimension }` plus — since Phase 19 (§5.4) — the
   * §4.2 `pieceType` the panel's piece displays render in — read-only from the
   * panel's point of view (`HELP_PANEL_LENS`'s setter is the identity): the
   * panel's one user interaction, the piece selection, is panel-local UI state
   * (the `useHelpPanelState` tier), never a write back through the slice, so the
   * slice simply mirrors `preferences.scalars`/`pieceType` as the shell state
   * changes.
   */
  readonly help: TelescopedProps<HelpPanelState>;
  /**
   * §5.8 / Phase 16: the preferences drawer's open state — shell-local UI state
   * (the `useAppState` tier, §7.2.1's "dialog open/closed", the same shape as the
   * finished-game Dialog's Phase 15 flag), not `AppState`: opening/closing the
   * drawer changes no preference or game field, so it never reaches the telescope.
   */
  readonly preferencesDrawerOpen: boolean;
  /**
   * §5.8 / Phase 16: the top-bar Preferences button's (gear icon's) click — flips
   * the drawer's open state through the state tier's setter (§7.2: event-handler
   * closures live in the view model, not the render function).
   */
  readonly onPreferencesToggle: () => void;
  /**
   * §5.8 / Phase 16: the drawer's dismissal — MUI fires its `onClose` on the
   * backdrop click and on Escape; it closes the drawer through the state tier's
   * setter, zero-argument on purpose (the committed next state does not depend on
   * which source fired).
   */
  readonly onPreferencesDrawerClose: () => void;
  /**
   * §5.9 / Phase 17: the App → `NewGamePanel` magnification (§7.2) onto the
   * panel's slice — the shell's §4.2 `scalars` (the board builder's
   * `size`/`dimension`/`base` inputs) plus the §5.13/§5.9 game clock origin
   * (`gamePlay.startTime`). Read-and-write from the panel's point of view,
   * like the preferences slice: the Board Size select's changes stay LOCAL
   * to the panel (§4.1's size→dimension rule — no shell state moves until
   * the player commits), and the Start button's one commit writes the
   * selected scalars and a fresh `startTime` back through this slice; the
   * `NEW_GAME_PANEL_LENS` setter realises it by rebuilding the board (Phase
   * 2's `buildBoard`), unfolding a fresh puzzle (Phase 3's `unfoldGame`),
   * resetting `gamePlay.startTime`, and closing the panel (§5.9).
   */
  readonly newGame: TelescopedProps<NewGamePanelState>;
  /**
   * §5.9 / Phase 17: the New Game drawer's open state, projected from
   * `AppState.newGameDrawerOpen` — shell-wide, because the panel's Start
   * commit writes it (§5.9 "closes the panel") as well as the top-bar
   * toggle and the drawer's own dismissal.
   */
  readonly newGameDrawerOpen: boolean;
  /**
   * §5.9 / Phase 17: the top-bar New Game button's (RestartAlt icon's)
   * click — toggles the New Game drawer through the shell telescope (a
   * `AppState` write via `setNewGameDrawerOpen`, not a local-UI-state flip:
   * the flag is shared with the panel's Start commit).
   */
  readonly onNewGameToggle: () => void;
  /**
   * §5.9 / Phase 17: the New Game drawer's dismissal — MUI fires its
   * `onClose` as `(event, reason)` on both the backdrop-click and
   * Escape-key paths; it closes the drawer through the shell telescope,
   * zero-argument on purpose (the committed next state does not depend on
   * which source fired).
   */
  readonly onNewGameDrawerClose: () => void;
  /**
   * §5.10 / Phase 18: the help drawer's open state — shell-local UI state (the
   * `useAppState` tier, the same shape as the preferences drawer's Phase 16
   * flag): opening/closing the drawer changes no preference or game field, so
   * it never reaches the telescope.
   */
  readonly helpDrawerOpen: boolean;
  /**
   * §5.10 / Phase 18: the top-bar Help button's click — flips the help drawer's
   * open state through the state tier's setter (§7.2: event-handler closures
   * live in the view model, not the render function).
   */
  readonly onHelpToggle: () => void;
  /**
   * §5.10 / Phase 18: the help drawer's dismissal — MUI fires its `onClose` on
   * the backdrop click and on Escape; it closes the drawer through the state
   * tier's setter, zero-argument on purpose.
   */
  readonly onHelpDrawerClose: () => void;
  /** §5.12: the invalid-move Snackbar, projected from `invalidMoveSnackbarOpen`. */
  readonly snackbarOpen: boolean;
  /**
   * §5.12: the invalid-move Snackbar's dismissal closure (Phase 11) — MUI fires it on
   * auto-hide / click-away / Escape / the Alert's close button; it commits the
   * shell's `invalidMoveSnackbarOpen` back to closed through the telescope.
   */
  readonly onInvalidMoveSnackbarClose: () => void;
  /**
   * §5.13 (Phase 15): the game-finished Dialog's open state — derived, not stored:
   * open exactly while the tray is empty (`availablePieces.size === 0`, §3.6) and the
   * player has not dismissed it since the tray emptied; closed at every other tray
   * state, including immediately after a fresh New Game start.
   */
  readonly dialogOpen: boolean;
  /**
   * §5.13: the finished-game outcome while the Dialog is open — `true` when
   * `gameIsSolvable` (Phase 3's `stateIsValid`) holds, picking the success alert;
   * `false` picks the failure alert. Stable for the Dialog's whole open lifetime:
   * with the tray empty no placement is possible, and the one state change that
   * refills the tray (Undo) closes the Dialog at the same time.
   */
  readonly dialogSuccess: boolean;
  /**
   * §5.13: the elapsed-time string for the success alert, formatted exactly
   * `{h}h {m}m {s}s` (e.g. `0h 2m 15s`) — the difference between the tray-emptying
   * moment and `gamePlay.startTime`, captured once at that moment (Phase 15's
   * `useAppState` tier's `finishedElapsedMs`) and held static for the Dialog's
   * whole open lifetime — NOT a live read of a running clock, which would keep
   * the string advancing after the game has ended. Rendered only by
   * the success alert.
   */
  readonly dialogElapsed: string;
  /**
   * §5.13 (Phase 15): the game-finished Dialog's dismissal closure — MUI fires it on
   * Escape / backdrop click. Dismissal is local UI state (the Dialog stays closed
   * while the tray remains empty, so the player can reach Undo and run the
   * "press undo until the happy face reappears" recovery loop, §5.13), and it resets
   * when the tray refills, so the next time the tray empties the Dialog opens again.
   */
  readonly onGameFinishedDialogClose: () => void;
}
