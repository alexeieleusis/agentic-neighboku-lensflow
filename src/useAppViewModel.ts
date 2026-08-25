import { useMemo } from "react";
import { Lens } from "telescopejs";
import type { AppState, AppViewModel, TopBarView } from "./App.types.ts";
import type { AvailablePiecesTrayState } from "./components/AvailablePiecesTray/AvailablePiecesTray.types.ts";
import type { BoardDisplayState } from "./components/BoardDisplay/BoardDisplay.types.ts";
import type { DragHint } from "./components/DraggablePiece/DraggablePiece.types.ts";
import type { TelescopedProps } from "./base/TelescopeComponent.ts";
import { stateIsValid } from "./game/gameBuilder.ts";
import {
  buildAvailablePiecesTrayState,
  buildBoardDisplayState,
} from "./useAppDomain.ts";

/**
 * The shell's view-model hook (requirements §7.2): the shell's orchestrator tier
 * (Phase 8's hook split, §7.2.1). Composes the pure slice derivations
 * (`useAppDomain.ts`) with the §7.2 magnified-telescope parent→child flow
 * (App → `BoardDisplay`, App → `AvailablePiecesTray`) and stays wiring-only. There is
 * no local non-telescope UI state in the shell, so no `useAppState` tier; the shell's
 * user actions (drag-end, §5.6; the Phase 11 invalid-move Snackbar dismissal, §5.12)
 * live in `useAppActions.ts`.
 */
export function useAppViewModel(
  props: Readonly<TelescopedProps<AppState>>,
): AppViewModel {
  const { game, preferences, invalidMoveSnackbarOpen, gameFinishedDialogOpen } =
    props.state;

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

  const topBar = useMemo<TopBarView>(
    () => ({
      undoEnabled: game.placedCells.length > 0,
      solvability: {
        visible: preferences.hints.gameIsSolvable,
        solvable: stateIsValid(game),
      },
    }),
    [game, preferences.hints.gameIsSolvable],
  );

  return {
    board,
    tray,
    dragHint,
    topBar,
    snackbarOpen: invalidMoveSnackbarOpen,
    dialogOpen: gameFinishedDialogOpen,
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
