import { useMemo } from "react";
import { Lens } from "telescopejs";
import type { AppState, AppViewModel, TopBarView } from "./App.types.ts";
import type { AvailablePiecesTrayState } from "./components/AvailablePiecesTray/AvailablePiecesTray.types.ts";
import type { BoardDisplayState } from "./components/BoardDisplay/BoardDisplay.types.ts";
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
  // the board slice. The board is a derived view of `game.board`; placement commits
  // rebuild `game` wholesale through the shell telescope (`resolveDragDrop` →
  // `placePiece`), never through this slice — so the slice simply mirrors
  // `game.board` as the shell state changes.
  const board = useMemo<TelescopedProps<BoardDisplayState>>(
    () => ({
      state: buildBoardDisplayState(game, preferences.pieceType),
      telescope: props.telescope.magnify(BOARD_DISPLAY_LENS),
    }),
    [game, preferences.pieceType, props.telescope],
  );

  // App → AvailablePiecesTray (§7.2): the same read-only magnification onto the tray
  // slice — a derived view of `game.availablePieces` (+ `game.size`); it mirrors the
  // shell state's tray slice as placements (and Phase 10's undos) rebuild `game`.
  const tray = useMemo<TelescopedProps<AvailablePiecesTrayState>>(
    () => ({
      state: buildAvailablePiecesTrayState(game),
      telescope: props.telescope.magnify(AVAILABLE_PIECES_TRAY_LENS),
    }),
    [game, props.telescope],
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
    topBar,
    snackbarOpen: invalidMoveSnackbarOpen,
    dialogOpen: gameFinishedDialogOpen,
  };
}

/**
 * The App → BoardDisplay magnification (§7.2). The getter derives the board slice from
 * the shell state; the setter is deliberately the identity: the board is a read-only
 * projection of `game.board` — any write through the board telescope is a no-op, since
 * placement is committed by rebuilding `game` wholesale and updating the shell
 * telescope instead (`resolveDragDrop` in `useAppDomain.ts`).
 */
const BOARD_DISPLAY_LENS = new Lens<AppState, BoardDisplayState>(
  (state) => buildBoardDisplayState(state.game, state.preferences.pieceType),
  (_boardState, state) => state,
);

/**
 * The App → AvailablePiecesTray magnification (§7.2). Same deliberate asymmetry: the
 * tray is a read-only projection of `game.availablePieces`, mirrored from the shell
 * state rather than written through.
 */
const AVAILABLE_PIECES_TRAY_LENS = new Lens<AppState, AvailablePiecesTrayState>(
  (state) => buildAvailablePiecesTrayState(state.game),
  (_trayState, state) => state,
);
