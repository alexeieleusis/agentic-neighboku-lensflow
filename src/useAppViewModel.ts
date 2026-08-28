import { useMemo } from "react";
import { Lens } from "telescopejs";
import type { AppPreferences, AppState, AppViewModel } from "./App.types.ts";
import type { AvailablePiecesTrayState } from "./components/AvailablePiecesTray/AvailablePiecesTray.types.ts";
import type { BoardDisplayState } from "./components/BoardDisplay/BoardDisplay.types.ts";
import type { DragHint } from "./components/DraggablePiece/DraggablePiece.types.ts";
import type { SolvabilityIconState } from "./components/SolvabilityIcon/SolvabilityIcon.types.ts";
import type { NewGamePanelState } from "./components/NewGamePanel/NewGamePanel.types.ts";
import type { TelescopedProps } from "./base/TelescopeComponent.ts";
import { useAppActions } from "./useAppActions.ts";
import { useAppState } from "./useAppState.ts";
import {
  buildAvailablePiecesTrayState,
  buildBoardDisplayState,
  buildNewGamePanelState,
  buildSolvabilityIconState,
  formatElapsed,
  startNewGame,
} from "./useAppDomain.ts";

/**
 * The shell's view-model hook (requirements §7.2): the shell's orchestrator tier
 * (Phase 8's hook split, §7.2.1; re-evaluated at Phase 15 against docs/CONVENTIONS.md's
 * non-trivial scale rule). Composes:
 *
 *   - the pure derivations (`useAppDomain.ts` — slice builders, the drag-drop /
 *     drag-hint state machines, the Phase 15 §5.13 finished/success/elapsed
 *     derivations),
 *   - the state tier (`useAppState.ts` — the finished-game Dialog's one-time
 *     elapsed capture and its local dismissal),
 *   - the action tier (`useAppActions.ts` — the drag-lifecycle monitor and the
 *     two overlay dismissals),
 *
 * and stays wiring-only: it owns no business logic of its own. The Phase 15 §5.13
 * derivations land on the returned view model as `dialogOpen` (tray empty AND not
 * dismissed), `dialogSuccess` (Phase 3's `stateIsValid` — the move engine's existing
 * `gameIsSolvable` result, consumed, never recomputed) and `dialogElapsed`
 * (`formatElapsed` of the state tier's `finishedElapsedMs` — frozen at the
 * tray-emptying moment, never a live read of a running clock), and the top-bar
 * solvability indicator
 * moves out of the `topBar` view into its own `solvability` slice (the App →
 * `SolvabilityIcon` magnification, Phase 15) so the indicator component renders it
 * itself instead of the shell inlining it.
 */
export function useAppViewModel(
  props: Readonly<TelescopedProps<AppState>>,
): AppViewModel {
  const { game, preferences, invalidMoveSnackbarOpen } = props.state;

  // Phase 15's state tier, created ONCE here and shared with the action tier:
  // the dismissal flag and the elapsed capture each have a single source of
  // truth, and the orchestrator strips the setter before the public view model
  // reaches RenderApp (docs/CONVENTIONS.md split-hook rule).
  const internal = useAppState(props);
  const actions = useAppActions(props, internal);

  // App → BoardDisplay (§7.2): a read-only magnification of the shell telescope onto
  // the board slice. The board is a derived view of `game.board` (plus, since Phase
  // 12, `game.cellToFitPieces` and the shell's two hint preferences); placement
  // commits rebuild `game` wholesale through the shell telescope (`resolveDragDrop` →
  // `placePiece`), never through this slice — so the slice simply mirrors
  // `game.board` as the shell state changes.
  const board = useMemo<TelescopedProps<BoardDisplayState>>(
    () => ({
      state: buildBoardDisplayState(game, preferences),
      telescope: props.telescope.magnify(BOARD_DISPLAY_LENS),
    }),
    [game, preferences, props.telescope],
  );

  // App → AvailablePiecesTray (§7.2): the magnification onto the tray slice — a view
  // of the whole `Game` (its tray/fit-cache fields feed the columns; Phase 13's
  // click-to-place hands a `(piece, cell)` to `placePiece`, which needs the whole
  // game) plus the two tray-scoped hint flags. Reads mirror the shell state as
  // placements (and Phase 10's undos) rebuild `game`; the one write path is Phase
  // 13's commit (see the lens below).
  const tray = useMemo<TelescopedProps<AvailablePiecesTrayState>>(
    () => ({
      state: buildAvailablePiecesTrayState(game, preferences.hints),
      telescope: props.telescope.magnify(AVAILABLE_PIECES_TRAY_LENS),
    }),
    [game, preferences.hints, props.telescope],
  );

  // App → DragFitHintIcon (§7.2, Phase 14): the dedicated magnification onto the
  // shell's `dragHint` slice — the READ side of the §5.6 DragHint channel. It is an
  // independent telescope from the one the shell's drag-lifecycle monitor
  // (`useAppActions`) writes through: both magnify the same `DRAG_HINT_LENS` onto the
  // same slice, and that is the whole channel — the icon never receives the hint as a
  // raw prop or callback, and the monitor never writes through the shell's general
  // telescope or the board/tray slices.
  const dragHint = useMemo<TelescopedProps<DragHint>>(
    () => ({
      state: props.state.dragHint,
      telescope: props.telescope.magnify(DRAG_HINT_LENS),
    }),
    [props.state.dragHint, props.telescope],
  );

  // App → SolvabilityIcon (§7.2, Phase 15): the dedicated magnification onto the
  // §5.13 solvability-indicator slice — the §4.2 `hints.gameIsSolvable` preference
  // plus Phase 3's `stateIsValid` result on `game`, both derived upstream in the
  // shell (via `buildSolvabilityIconState`) so the indicator component itself only
  // maps the two booleans to its icon and never recomputes solvability. The memo
  // recomputes exactly when one of its two inputs moves (a placement/undo rebuild
  // `game`; the preference moves with the Phase 16 preferences update), the same
  // way the board/tray memos do.
  const hintGameIsSolvable = preferences.hints.gameIsSolvable;
  const solvability = useMemo<TelescopedProps<SolvabilityIconState>>(
    () => ({
      state: buildSolvabilityIconState(game, hintGameIsSolvable),
      telescope: props.telescope.magnify(SOLVABILITY_ICON_LENS),
    }),
    [game, hintGameIsSolvable, props.telescope],
  );

  // App → PreferencesDisplay (§7.2, Phase 16): the magnification onto the §4.2
  // `preferences` slice — unlike the board/tray/solvability slices above, this one
  // is read-AND-write from the panel's point of view: the drawer's 9 controls each
  // read their own value off the slice's `state` and commit their changes back
  // through the slice's telescope (`PREFERENCES_LENS`'s setter replaces
  // `AppState.preferences` wholesale), so a toggle re-derives every downstream
  // slice (board hints, tray hints, solvability visibility) on the same emission.
  const preferencesSlice = useMemo<TelescopedProps<AppPreferences>>(
    () => ({
      state: preferences,
      telescope: props.telescope.magnify(PREFERENCES_LENS),
    }),
    [preferences, props.telescope],
  );

  // App → NewGamePanel (§7.2, Phase 17): the magnification onto the panel's
  // slice — the shell's §4.2 `scalars` (the board builder's inputs) plus the
  // §5.13/§5.9 game clock origin. Read-and-write from the panel's point of
  // view, like the preferences slice: the Board Size select's changes stay
  // LOCAL to the panel (§4.1's size→dimension rule — no shell state moves
  // until the player commits), and the Start button's one commit writes the
  // selected scalars and a fresh `startTime` through this slice;
  // `NEW_GAME_PANEL_LENS`'s setter realises it by rebuilding the board
  // (Phase 2's `buildBoard`), unfolding a fresh puzzle (Phase 3's
  // `unfoldGame`), resetting `gamePlay.startTime`, and closing the panel
  // (§5.9). The memo recomputes exactly when the shell state it projects
  // moves — a Start commit, a preferences change, or any other emission.
  const newGame = useMemo<TelescopedProps<NewGamePanelState>>(
    () => ({
      state: buildNewGamePanelState(props.state),
      telescope: props.telescope.magnify(NEW_GAME_PANEL_LENS),
    }),
    [props.state, props.telescope],
  );

  // §5.13 (Phase 15): the finished-game Dialog. `dialogOpen` is the derivation the
  // §3.6 empty-tray transition drives — open exactly while the tray is empty and the
  // player has not dismissed it; closed at every other tray state, including a fresh
  // New Game start (whose tray always holds pieces). `dialogSuccess` is Phase 3's
  // solvability result at that moment (stable for the Dialog's whole open lifetime:
  // with the tray empty no placement is possible, and Undo — the one refill — closes
  // the Dialog in the same render). `dialogElapsed` is the §5.13 `{h}h {m}m {s}s`
  // string: `formatElapsed` of the state tier's `finishedElapsedMs` — the elapsed
  // duration captured (and frozen) at the moment the tray empties, so the success
  // alert's counter does NOT keep advancing while the Dialog is open: there is no
  // ticking clock to read — the value is a one-time `Date.now()` capture, not a
  // live projection. Rendered by the success alert only.
  return {
    board,
    tray,
    dragHint,
    solvability,
    preferences: preferencesSlice,
    newGame,
    snackbarOpen: invalidMoveSnackbarOpen,
    onInvalidMoveSnackbarClose: actions.onInvalidMoveSnackbarClose,
    preferencesDrawerOpen: internal.preferencesDrawerOpen,
    onPreferencesToggle: actions.onPreferencesToggle,
    onPreferencesDrawerClose: actions.onPreferencesDrawerClose,
    newGameDrawerOpen: props.state.newGameDrawerOpen,
    onNewGameToggle: actions.onNewGameToggle,
    onNewGameDrawerClose: actions.onNewGameDrawerClose,
    dialogOpen: internal.trayEmpty && !internal.dialogDismissed,
    dialogSuccess: internal.solvable,
    dialogElapsed: formatElapsed(internal.finishedElapsedMs ?? 0),
    onGameFinishedDialogClose: actions.onGameFinishedDialogClose,
  };
}

/**
 * The App → BoardDisplay magnification (§7.2). The getter derives the board slice from
 * the shell state; the setter is deliberately the identity: the board is a read-only
 * projection of `game.board` (and, since Phase 12, of `game.cellToFitPieces` and the
 * shell's hint preferences) — any write through the board telescope is a no-op, since
 * placement is committed by rebuilding `game` wholesale and updating the shell
 * telescope instead (`resolveDragDrop` in `useAppDomain.ts`).
 */
const BOARD_DISPLAY_LENS = new Lens<AppState, BoardDisplayState>(
  (state) => buildBoardDisplayState(state.game, state.preferences),
  (_boardState, state) => state,
);

/**
 * The App → AvailablePiecesTray magnification (§7.2). The getter derives the tray
 * slice (the whole `Game` plus the two tray-scoped hint flags — see
 * `buildAvailablePiecesTrayState`). The setter is Phase 13's click-to-place commit
 * path, mirroring the undo lens's shape: the tray's write carries its next slice —
 * whose `game` is the next `Game` the tray's action tier produced through the
 * shared `placePiece` — and the setter realises it by lifting `trayState.game` onto
 * `AppState.game`. The hint flags are shell-owned (they only move when the
 * preferences update, Phase 16), so the setter keeps the shell's own; every other
 * write through this slice is that commit — nothing else writes through it.
 */
const AVAILABLE_PIECES_TRAY_LENS = new Lens<AppState, AvailablePiecesTrayState>(
  (state) => buildAvailablePiecesTrayState(state.game, state.preferences.hints),
  (trayState, state) => ({ ...state, game: trayState.game }),
);

/**
 * The dedicated App → `dragHint` magnification (§5.6/§7.2, Phase 14): the shell's
 * `DragHint` slice as its own lens onto its own `DragHint` value — the “dedicated
 * telescope” the requirement names, shared by two independent magnifications of it:
 * the shell's drag-lifecycle monitor (`useAppActions`) writes the hint through one as
 * drag state changes, and the top bar's `DragFitHintIcon` reads it through the other
 * to choose its icon. Two telescopes, one lens, one slice — nothing else reads or
 * writes through it, so the hint never piggybacks on the shell's general telescope or
 * the board/tray slices.
 *
 * The setter is a no-op (input reference back, no stream re-emission) when the written
 * value already equals the slice's current value: `onDragOver` fires on every
 * hover-target change, and most of them leave the hint unchanged (e.g. moving between
 * two cells that both reject the piece).
 */
export const DRAG_HINT_LENS = new Lens<AppState, DragHint>(
  (state) => state.dragHint,
  (hint, state) =>
    hint === state.dragHint ? state : { ...state, dragHint: hint },
);

/**
 * The dedicated App → `SolvabilityIcon` magnification (§5.13/§7.2, Phase 15): the
 * solvability-indicator slice — `{ visible, solvable }` — as its own lens onto its own
 * shell-derived values, so the indicator renders through its own magnified telescope
 * like every other child slice, never through raw prop-drilled booleans. Both values
 * are derived (preference + Phase 3's `stateIsValid`), so the setter is the identity:
 * nothing writes through this slice — the values move only when `game` or the
 * preferences do, and the lens getter re-derives them on the next magnified read.
 */
export const SOLVABILITY_ICON_LENS = new Lens<AppState, SolvabilityIconState>(
  (state) =>
    buildSolvabilityIconState(
      state.game,
      state.preferences.hints.gameIsSolvable,
    ),
  (_iconState, state) => state,
);

/**
 * The App → `PreferencesDisplay` magnification (§5.8/§7.2, Phase 16): the shell's
 * §4.2 `preferences` slice as its own lens, unlike its three read-only
 * neighbours: the setter is a real commit path. Each of the panel's 9 controls
 * curries a `usePreferencesDisplayDomain` update function with the slice's
 * current `AppPreferences` and commits the result through the panel's magnified
 * telescope; this setter realises it by replacing `AppState.preferences`
 * wholesale: the hint surfaces (board, tray, solvability) re-derive on the
 * same emission, and the §5.12 move engine reads the live value through the
 * shell's drop path (`resolveDragDrop` mirrors the narrow `GamePreferences`
 * onto each `placePiece` call, Phase 16) — a toggle therefore steers the
 * running game on the very next drop. A write of the slice's own current
 * reference (a control event that leaves the value unchanged) returns the
 * input state, so the distinctUntilChanged'd stream re-emits nothing.
 */
const PREFERENCES_LENS = new Lens<AppState, AppPreferences>(
  (state) => state.preferences,
  (preferences, state) =>
    preferences === state.preferences ? state : { ...state, preferences },
);

/**
 * The App → `NewGamePanel` magnification (§5.9/§7.2, Phase 17): the panel's
 * slice — the shell's §4.2 `scalars` plus the §5.13/§5.9 game clock origin —
 * as its own lens, unlike the read-only board/tray/solvability neighbours:
 * the setter is a real commit path. The panel's Start button writes the
 * selected scalars and a fresh `startTime` through the panel's magnified
 * telescope; this setter realises that write by running Phase 17's pure
 * `startNewGame` — rebuild the board from the selected `size`/`dimension`
 * with the shell's own `base` (Phase 2's `buildBoard`; §4.1 keeps `base`
 * untouched by the size selector), unfold a fresh puzzle (Phase 3's
 * `unfoldGame`), reset `gamePlay.startTime` to the written value, record the
 * selected scalars on `preferences.scalars`, and close the panel (§5.9).
 * Nothing else writes through this slice: the Board Size select's changes
 * are the panel's local state, committed as a whole only on Start.
 */
const NEW_GAME_PANEL_LENS = new Lens<AppState, NewGamePanelState>(
  (state) => buildNewGamePanelState(state),
  (written, state) =>
    startNewGame(state, written.size, written.dimension, written.startTime),
);
