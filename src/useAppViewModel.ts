import { useMemo } from "react";
import { Lens } from "telescopejs";
import type { AppState, AppViewModel } from "./App.types.ts";
import type { AvailablePiecesTrayState } from "./components/AvailablePiecesTray/AvailablePiecesTray.types.ts";
import type { BoardDisplayState } from "./components/BoardDisplay/BoardDisplay.types.ts";
import type { DragHint } from "./components/DraggablePiece/DraggablePiece.types.ts";
import type { SolvabilityIconState } from "./components/SolvabilityIcon/SolvabilityIcon.types.ts";
import type { TelescopedProps } from "./base/TelescopeComponent.ts";
import { useAppActions } from "./useAppActions.ts";
import { useAppState } from "./useAppState.ts";
import {
  buildAvailablePiecesTrayState,
  buildBoardDisplayState,
  buildSolvabilityIconState,
  formatElapsed,
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
    snackbarOpen: invalidMoveSnackbarOpen,
    onInvalidMoveSnackbarClose: actions.onInvalidMoveSnackbarClose,
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
