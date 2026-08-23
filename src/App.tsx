import { useMemo } from "react";
import { DndContext, pointerWithin } from "@dnd-kit/core";
import AppBar from "@mui/material/AppBar";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SettingsIcon from "@mui/icons-material/Settings";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import UndoIcon from "@mui/icons-material/Undo";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import HelpIcon from "@mui/icons-material/Help";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "./base/TelescopeComponent.ts";
import type { AppState, AppViewModel, TopBarView } from "./App.types.ts";
import { stateIsValid } from "./game/gameBuilder.ts";
import type { Game } from "./game/gameBuilder.ts";
import { Lens } from "telescopejs";
import { BoardDisplay } from "./components/BoardDisplay/BoardDisplay.tsx";
import { AvailablePiecesTray } from "./components/AvailablePiecesTray/AvailablePiecesTray.tsx";
import type { AvailablePiecesTrayState } from "./components/AvailablePiecesTray/AvailablePiecesTray.types.ts";
import type {
  BoardCell,
  PieceType,
} from "./components/CellDisplay/CellDisplay.types.ts";
import type {
  BoardDisplayState,
  BoardRow,
} from "./components/BoardDisplay/BoardDisplay.types.ts";

/**
 * Root application shell (requirements §5.1). Established here as the outer
 * `state,telescope → useAppViewModel → RenderApp` fractal component (requirements §7.2)
 * and the shared shell-level `DndContext` ancestor (requirements §5.1,
 * docs/CONVENTIONS.md dnd-kit note). The board now renders as Phase 5's
 * `BoardDisplay`/`RowDisplay`/`CellDisplay` (§5.2) — section-colored CSS grid, but
 * still placeholder-level at the cell edge: filled cells do not yet use the shared
 * `PieceDisplay` from Phase 6, and there is no hint logic (Phase 12). The tray now
 * renders as Phase 7's `AvailablePiecesTray` (§5.5: one column per distinct remaining
 * piece value, counts, ascending sort, wrapping at the board's width — the `*` hint
 * and click-to-place buttons are Phase 13, the drag wiring Phase 8). The top bar remains
 * a bare-bones placeholder. The Snackbar (§5.13/§5.12) and the game-finished Dialog
 * (§3.6/§5.13) are present but closed/inactive.
 */
export const App: TelescopeComponent<AppState> = (
  props: TelescopedProps<AppState>,
): React.ReactElement => {
  return RenderApp(useAppViewModel(props));
};

/* -------------------------------------------------------------------------- */
/* useAppViewModel                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The shell's view-model hook. In Phase 5 every value is a pure derivation from the
 * current state snapshot (no telescope writes, no local UI state, no dnd-kit hooks),
 * so the `useAppDomain`/`useAppState`/`useAppActions`/`useAppViewModel` split that
 * docs/CONVENTIONS.md's scale rule requires for a non-trivial component is deferred
 * to the phase that first adds such logic to this shell (Phase 15's timer/dialog
 * derivation, and the actions wired by Phases 10/11/16/17/18). This module keeps it
 * inline and wiring-only for now so the shell skeleton exists without the files
 * Phase 4 is not allowed to create yet (`src/useApp*.ts`).
 */
function useAppViewModel(
  props: Readonly<TelescopedProps<AppState>>,
): AppViewModel {
  const { game, preferences, invalidMoveSnackbarOpen, gameFinishedDialogOpen } =
    props.state;

  // App → BoardDisplay (§7.2): a read-only magnification of the shell telescope onto
  // the board slice. The board is a derived view of `game.board`, so no action writes
  // through it this phase — the magnified telescope's stream simply mirrors the
  // board slice of the shell state.
  const board = useMemo<TelescopedProps<BoardDisplayState>>(
    () => ({
      state: buildBoardDisplayState(game, preferences.pieceType),
      telescope: props.telescope.magnify(BOARD_DISPLAY_LENS),
    }),
    [game, preferences.pieceType, props.telescope],
  );

  // App → AvailablePiecesTray (§7.2): a read-only magnification of the shell
  // telescope onto the tray slice. The tray is a derived view of
  // `game.availablePieces` (+ `game.size`), so no action writes through it this phase
  // — the magnified telescope's stream simply mirrors the shell state's tray slice,
  // exactly like the board's.
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

/* -------------------------------------------------------------------------- */
/* Pure domain-tier derivation helpers (moved to useAppDomain in a later      */
/* phase; no React imports here)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Flatten a frozen `Board` into Phase 5's `BoardDisplayState`: one `BoardRow` per
 * board row, cells in column order, plus the app-level `pieceType` the shell owns
 * (requirements §4.2) that cells forward to their droppable targets.
 */
function buildBoardDisplayState(
  game: Game,
  pieceType: PieceType,
): BoardDisplayState {
  const rows: BoardRow[] = [];
  for (let row = 0; row < game.size; row++) {
    const cells: BoardCell[] = [];
    for (let col = 0; col < game.size; col++) {
      cells.push({ row, col, piece: game.board[row][col] });
    }
    rows.push({ index: row, cells });
  }
  return { size: game.size, pieceType, rows };
}

/**
 * The App → BoardDisplay magnification (§7.2). The getter derives the board slice
 * from the shell state; the setter is deliberately the identity: the board is a
 * read-only projection of `game.board` this phase, so any write through the board
 * telescope is a no-op until Phase 8 routes placement through the move engine
 * (which rebuilds `game` wholesale and updates the shell telescope, not this slice).
 */
const BOARD_DISPLAY_LENS = new Lens<AppState, BoardDisplayState>(
  (state) => buildBoardDisplayState(state.game, state.preferences.pieceType),
  (_boardState, state) => state,
);

/**
 * The remaining tray slice the `AvailablePiecesTray` renders (§5.5): the board size
 * plus the move engine's remaining pieces, one entry per distinct piece value.
 */
function buildAvailablePiecesTrayState(game: Game): AvailablePiecesTrayState {
  return {
    size: game.size,
    availablePieces: game.availablePieces,
  };
}

/**
 * The App → AvailablePiecesTray magnification (§7.2). The getter derives the tray
 * slice from the shell state; the setter is deliberately the identity: the tray is a
 * read-only projection of `game.availablePieces` this phase, so any write through the
 * tray telescope is a no-op until Phase 8 routes placement through the move engine
 * (which rebuilds `game` wholesale and updates the shell telescope, not this slice).
 */
const AVAILABLE_PIECES_TRAY_LENS = new Lens<AppState, AvailablePiecesTrayState>(
  (state) => buildAvailablePiecesTrayState(state.game),
  (_trayState, state) => state,
);

/* -------------------------------------------------------------------------- */
/* RenderApp                                                                  */
/* -------------------------------------------------------------------------- */

function RenderApp(viewModel: Readonly<AppViewModel>): React.ReactElement {
  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: "44rem", mx: "auto" }}>
      <RenderTopBar topBar={viewModel.topBar} />
      <AppBoardTray viewModel={viewModel} />
      <RenderInvalidMoveSnackbar open={viewModel.snackbarOpen} />
      <RenderGameFinishedDialog open={viewModel.dialogOpen} />
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/* Top bar                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * §5.1 top bar. The six elements are in this exact fixed order, per the shell spec:
 * drag-fit-hint icon, Preferences button, New Game button, Undo button, solvability
 * icon, Help button. The Preferences / New Game / Help buttons and the drag-fit-hint
 * icon are inert this phase (later phases wire their panels); only Undo (disabled
 * state) and the solvability icon are derived from state.
 */
function RenderTopBar(
  props: Readonly<{ topBar: Readonly<TopBarView> }>,
): React.ReactElement {
  const { topBar } = props;
  const solvability = topBar.solvability;

  let solvabilityIcon: React.ReactElement | null = null;
  if (solvability.visible) {
    solvabilityIcon = solvability.solvable ? (
      <CheckCircleIcon
        aria-live="polite"
        aria-label="Position is solvable"
        sx={{ color: "success.main", p: 0.5 }}
      />
    ) : (
      <ReportProblemIcon
        aria-live="polite"
        aria-label="No solution exists"
        sx={{ color: "error.main", p: 0.5 }}
      />
    );
  }

  return (
    <AppBar position="static" sx={{ px: 1 }}>
      <Toolbar variant="dense">
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Tooltip title="Drag to place; right-click or swipe to rotate">
            <IconButton
              size="small"
              aria-label="Rotate piece to fit"
              sx={{ "& .MuiSvgIcon-root": { transform: "rotate(45deg)" } }}
            >
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Preferences">
            <IconButton size="small" aria-label="Preferences">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="New Game">
            <IconButton size="small" aria-label="New Game">
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
          {topBar.undoEnabled ? (
            <Tooltip title="Undo">
              <IconButton size="small" aria-label="Undo">
                <UndoIcon />
              </IconButton>
            </Tooltip>
          ) : (
            // No Tooltip wrapper while disabled: the button has no hover surface,
            // and MUI warns on a disabled button inside a Tooltip.
            <IconButton size="small" aria-label="Undo" disabled>
              <UndoIcon />
            </IconButton>
          )}
          {solvabilityIcon}
          <Tooltip title="Help">
            <IconButton size="small" aria-label="Help">
              <HelpIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

/* -------------------------------------------------------------------------- */
/* Board + shared DndContext ancestor (board and tray live under one context) */
/* -------------------------------------------------------------------------- */

/**
 * The shared shell-level `DndContext` ancestor (requirements §5.1, §5.6). This
 * component does *nothing but* construct `<DndContext>` and render its inner
 * descendant; any `useDraggable`/`useDroppable`/`useDndMonitor` registration added in a
 * later phase must live in `AppBoardTrayBoard` (a true descendant), NOT here in
 * `AppBoardTray`'s own body, per the dnd-kit gotcha at docs/CONVENTIONS.md.
 */
function AppBoardTray(
  props: Readonly<{ viewModel: Readonly<AppViewModel> }>,
): React.ReactElement {
  return (
    <DndContext collisionDetection={pointerWithin}>
      <AppBoardTrayBoard {...props} />
    </DndContext>
  );
}

/**
 * The DndContext-descendant that renders the `BoardDisplay` (§5.2) + the Phase 7
 * `AvailablePiecesTray` (§5.5). This is where a later phase will call
 * `useDraggable`/`useDroppable`/`useDndMonitor` (and register the `useDndMonitor`
 * drag-end handling).
 */
function AppBoardTrayBoard(
  props: Readonly<{ viewModel: Readonly<AppViewModel> }>,
): React.ReactElement {
  const { board, tray } = props.viewModel;
  return (
    <Stack spacing={2}>
      <BoardDisplay {...board} />
      <AvailablePiecesTray {...tray} />
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/* Overlays                                                                   */
/* -------------------------------------------------------------------------- */

/** §5.13/§5.12: closed by default; Phase 11 wires the open trigger + manual close. */
function RenderInvalidMoveSnackbar(
  props: Readonly<{ open: boolean }>,
): React.ReactElement {
  const { open } = props;
  return (
    <Snackbar open={open} autoHideDuration={6000}>
      <Alert severity="error" sx={{ width: "100%" }}>
        Invalid move!
      </Alert>
    </Snackbar>
  );
}

/** §3.6/§5.13: closed by default; Phase 15 drives it from the empty-tray state. */
function RenderGameFinishedDialog(
  props: Readonly<{ open: boolean }>,
): React.ReactElement {
  const { open } = props;
  return (
    <Dialog open={open} aria-describedby="game-finished-body">
      <DialogTitle>Game finished</DialogTitle>
      <DialogContent>
        <Typography
          id="game-finished-body"
          variant="body2"
          component="div"
          sx={{ color: "text.secondary" }}
        >
          This overlay is a skeleton; Phase 15 adds the success/failure alert.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
