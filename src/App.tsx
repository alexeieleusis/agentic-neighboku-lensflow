import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
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
import { useAppActions } from "./useAppActions.ts";
import { useAppViewModel } from "./useAppViewModel.ts";
import { BoardDisplay } from "./components/BoardDisplay/BoardDisplay.tsx";
import { AvailablePiecesTray } from "./components/AvailablePiecesTray/AvailablePiecesTray.tsx";

/**
 * Root application shell (requirements §5.1) and the shared shell-level `DndContext`
 * ancestor (Phase 8, §5.6/docs/CONVENTIONS.md dnd-kit note). `App` constructs
 * `<DndContext>` around its descendant and configures the input sensors that context
 * accepts (§5.6, §7.6): `useDraggable` (in `DraggablePiece`, tray), `useDroppable` (in
 * `CellDisplay`, board) and `useDndMonitor` (the shell's drag-end monitor) all register
 * with the nearest ANCESTOR context via React context, so they only work when called
 * from a component rendered INSIDE `<DndContext>` — that is `AppConnected` below, never
 * this function's own body. One shared context covers board + tray, so a piece can be
 * picked up from the tray and dropped on the board (§5.1).
 *
 * Phase 9 (§7.6): the context accepts both input modalities simultaneously — desktop
 * pointer/pen and mobile touch — with no separate mobile-only context or code path, and
 * the drop handling (`AppConnected` → `useAppActions.onDragEnd` → `resolveDragDrop` →
 * `placePiece`) gains no touch-specific branch: the sensors only decide how a gesture
 * STARTS, and the shared drag-end path decides what a finished drag does, identically
 * for every modality. Sensor configuration is the only touch concern this phase adds.
 */
export const App: TelescopeComponent<AppState> = (
  props: TelescopedProps<AppState>,
): React.ReactElement => {
  // §5.6/§7.6 — the sensor set this shared DndContext accepts input through. Phase 8
  // ran on the library's default set (unconstrained PointerSensor + KeyboardSensor);
  // Phase 9 makes that set explicit — so no input mode the shell already had
  // regresses — and adds the mobile-touch path on top:
  //
  // PointerSensor — the desktop pointer/pen path, unconstrained exactly as the default
  // was, so Phase 8's pointer behavior is unchanged. It also ends up owning every
  // modern touch gesture: touch input raises `pointerdown` before `touchstart`, and
  // dnd-kit's activation binding ignores a gesture another sensor already claimed —
  // so the later `touchstart` is a no-op and the pointer path drives the whole drag.
  // It is the tray piece's own `touch-action: none` (Phase 8's `dragPieceStyle`,
  // `useDraggablePieceDomain.ts`) that keeps the browser from scrolling that gesture
  // away.
  //
  // TouchSensor — the mobile path, configured with the delay/tolerance activation
  // constraint dnd-kit's mobile guidance prescribes, for input that never raises
  // pointer events: holding the piece still for `delay` ms activates the drag, and
  // dnd-kit's non-passive `touchmove` listener then preventDefaults every further
  // movement so the page cannot scroll mid-drag; moving more than `tolerance` px
  // within the delay aborts the pending activation, so a page scroll that BEGAN on
  // the piece is never hijacked into a drag. Its `setup()` hook is run by
  // `DndContext`'s sensor setup, not by this list, and installs the window-level
  // non-passive `touchmove` listener iOS Safari requires for those preventDefaults to
  // take effect at all.
  //
  // KeyboardSensor — kept verbatim from the library default so Phase 8's keyboard
  // drag path (focus a tray piece; Space/Enter picks it up, arrows move it, Space
  // drops it through the same shared `placePiece` path) does not regress.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor),
  );

  return (
    <DndContext collisionDetection={pointerWithin} sensors={sensors}>
      <AppConnected {...props} />
    </DndContext>
  );
};

/**
 * The `DndContext` descendant that runs the shell's hook tiers and renders the shell:
 * the view model (`useAppViewModel` — the `state,telescope → useXViewModel → RenderX`
 * contract, requirements §7.2) and the drag-end monitor (`useAppActions.onDragEnd`,
 * registered via `useDndMonitor`, which reads the dropped piece's value and the target
 * cell off the event and commits through `placePiece` — the shared placement path,
 * §5.6; Phase 13's click-to-place will call the same path).
 */
function AppConnected(
  props: Readonly<TelescopedProps<AppState>>,
): React.ReactElement {
  useAppActions(props);
  return RenderApp(useAppViewModel(props));
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
 * icon are inert this phase (later phases wire their panels); the icon's live drag
 * state (§5.6's `DragHint`) lands in Phase 14. Only Undo (disabled state) and the
 * solvability icon are derived from state.
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
/* Board + tray (both under the shared shell-level DndContext)               */
/* -------------------------------------------------------------------------- */

/**
 * §5.1: the board (`BoardDisplay`, §5.2) and the tray (`AvailablePiecesTray`, §5.5 /
 * Phase 8's `DraggablePiece` columns) side by side — plain grouping now that the
 * `<DndContext>` ancestor lives at the shell level in `App` above.
 */
function AppBoardTray(
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
