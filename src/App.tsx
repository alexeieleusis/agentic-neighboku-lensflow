import { useMemo } from "react";
import { DndContext, pointerWithin } from "@dnd-kit/core";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
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
import type {
  AppState,
  AppViewModel,
  BoardCellView,
  BoardView,
  TrayColumnView,
  TrayView,
  TopBarView,
} from "./App.types.ts";
import type { Piece } from "./game/entities.ts";
import { stateIsValid } from "./game/gameBuilder.ts";
import type { Game } from "./game/gameBuilder.ts";

/**
 * Root application shell (requirements §5.1). Established here as the outer
 * `state,telescope → useAppViewModel → RenderApp` fractal component (requirements §7.2)
 * and the shared shell-level `DndContext` ancestor (requirements §5.1,
 * docs/CONVENTIONS.md dnd-kit note). The top bar, board, and tray are intentionally
 * bare-bones placeholder renderings this phase; their full presentation lands in later
 * phases (BoardDisplay/CellDisplay §5.2, PieceDisplay §5.3/§5.4, the real tray §5.5,
 * and the dnd wiring §5.6). The Snackbar (§5.13/§5.12) and the game-finished Dialog
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
 * The shell's view-model hook. In Phase 4 every value is a pure derivation from the
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

  const board = useMemo<BoardView>(
    () => ({ size: game.size, cells: mapBoardToViewModel(game) }),
    [game],
  );

  const tray = useMemo<TrayView>(
    () => ({ columns: mapTrayToViewModel(game) }),
    [game],
  );

  const topBar = useMemo<TopBarView>(
    () => ({
      undoEnabled: game.placedCells.length > 0,
      solvability: {
        visible: preferences.hintGameIsSolvable,
        solvable: stateIsValid(game),
      },
    }),
    [game, preferences.hintGameIsSolvable],
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
/* phase; no React or telescope imports here)                                 */
/* -------------------------------------------------------------------------- */

/** Flatten a frozen `Board` into an ordered list of view-model cells. */
function mapBoardToViewModel(game: Game): readonly BoardCellView[] {
  const cells: BoardCellView[] = [];
  for (let row = 0; row < game.size; row++) {
    for (let col = 0; col < game.size; col++) {
      cells.push({ row, col, piece: game.board[row][col] });
    }
  }
  return cells;
}

/** The remaining tray pieces, one view-model column per distinct piece value. */
function mapTrayToViewModel(game: Game): readonly TrayColumnView[] {
  const columns: TrayColumnView[] = [];
  for (const [piece, count] of game.availablePieces) {
    columns.push({ piece, count });
  }
  return columns;
}

/** Bare-bones text for a piece until Phase 6 introduces `PieceDisplay`. */
function pieceDisplay(piece: Piece): string {
  return piece.join(",");
}

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
          {solvability.visible ? (
            solvability.solvable ? (
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
            )
          ) : null}
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
 * The DndContext-descendant that renders the bare-bones board + tray. This is where a
 * later phase will call `useDraggable`/`useDroppable`/`useDndMonitor` (and register the
 * `useDndMonitor` drag-end handling).
 */
function AppBoardTrayBoard(
  props: Readonly<{ viewModel: Readonly<AppViewModel> }>,
): React.ReactElement {
  const { board, tray } = props.viewModel;
  return (
    <Stack spacing={2}>
      <RenderBoard board={board} />
      <RenderTray tray={tray} />
    </Stack>
  );
}

function RenderBoard(
  props: Readonly<{ board: Readonly<BoardView> }>,
): React.ReactElement {
  const { board } = props;
  return (
    <Box>
      <Typography variant="subtitle2" component="div" sx={{ mb: 1 }}>
        Board ({board.size}×{board.size})
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))`,
          gap: "0.25rem",
          maxWidth: "min(44rem, 100%)",
        }}
      >
        {board.cells.map((cell) => (
          <BoardCell key={`${cell.row}-${cell.col}`} cell={cell} />
        ))}
      </Box>
    </Box>
  );
}

function BoardCell(
  props: Readonly<{ cell: Readonly<BoardCellView> }>,
): React.ReactElement {
  const { cell } = props;
  return (
    <Box
      sx={{
        aspectRatio: "1",
        display: "grid",
        placeItems: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 0.5,
      }}
      aria-label={
        cell.piece === null
          ? `Empty cell, row ${cell.row + 1}, column ${cell.col + 1}`
          : `Piece ${pieceDisplay(cell.piece)}, row ${cell.row + 1}, column ${cell.col + 1}`
      }
    >
      {cell.piece === null ? (
        <Typography variant="caption" sx={{ color: "text.disabled" }}>
          ·
        </Typography>
      ) : (
        <Typography variant="caption">{pieceDisplay(cell.piece)}</Typography>
      )}
    </Box>
  );
}

function RenderTray(
  props: Readonly<{ tray: Readonly<TrayView> }>,
): React.ReactElement {
  const { tray } = props;
  return (
    <Box>
      <Typography variant="subtitle2" component="div" sx={{ mb: 1 }}>
        Piece tray
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
        {tray.columns.map((column) => (
          <TrayColumn key={pieceDisplay(column.piece)} column={column} />
        ))}
      </Stack>
    </Box>
  );
}

function TrayColumn(
  props: Readonly<{ column: Readonly<TrayColumnView> }>,
): React.ReactElement {
  const { column } = props;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: "0.5rem",
        px: 1,
        py: 0.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 0.5,
      }}
    >
      <Typography variant="caption">{pieceDisplay(column.piece)}</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        ×{column.count}
      </Typography>
    </Box>
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
