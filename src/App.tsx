import { useMemo } from "react";
import { Lens } from "telescopejs";
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import HelpIcon from "@mui/icons-material/Help";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "./base/TelescopeComponent.ts";
import type { AppState, AppViewModel, TopBarView } from "./App.types.ts";
import { undoPlay } from "./game/gameBuilder.ts";
import { useAppActions } from "./useAppActions.ts";
import type { AppActions } from "./useAppActions.ts";
import { useAppViewModel } from "./useAppViewModel.ts";
import { BoardDisplay } from "./components/BoardDisplay/BoardDisplay.tsx";
import { AvailablePiecesTray } from "./components/AvailablePiecesTray/AvailablePiecesTray.tsx";
import { UndoButton } from "./components/UndoButton/UndoButton.tsx";
import type { UndoButtonState } from "./components/UndoButton/UndoButton.types.ts";

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
 * contract, requirements §7.2), the action tier (`useAppActions` — the drag-end
 * monitor registered via `useDndMonitor` reads the dropped piece's value and the
 * target cell off the event and commits through `placePiece`, the shared placement
 * path, §5.6; Phase 13's click-to-place will call the same path — plus Phase 11's
 * invalid-move Snackbar dismissal), and the Phase 10 undo slice (`useUndoSlice` — the
 * App → `UndoButton` §7.2 magnification).
 */
function AppConnected(
  props: Readonly<TelescopedProps<AppState>>,
): React.ReactElement {
  const actions = useAppActions(props);
  const viewModel = useAppViewModel(props);
  const undo = useUndoSlice(props);
  return RenderApp({ viewModel, undo, actions });
}

/* -------------------------------------------------------------------------- */
/* App → UndoButton magnification (Phase 10, §5.7)                             */
/* -------------------------------------------------------------------------- */

/**
 * The App → UndoButton magnification (§7.2, Phase 10). `get` projects the
 * move-history depth; `set` is the commit path: any write through the button's
 * telescope applies Phase 3's `undoPlay` to the shell's `game` (tray restore,
 * cell blanking, both fit caches recomputed — §3.5). The written slice value is
 * the slice the button declares it expects after undoing one move; the setter
 * realises it by evolving `game` rather than the slice itself, because only the
 * move engine can derive the rest of the new `Game`. The empty-history guard
 * (§8.4) lives on the button side, not here: `set` applies `undoPlay` unguarded.
 */
const UNDO_BUTTON_LENS = new Lens<AppState, UndoButtonState>(
  (state) => ({ placedMoves: state.game.placedCells.length }),
  (_undoState, state) => ({ ...state, game: undoPlay(state.game) }),
);

/**
 * The `UndoButton`'s slice (`TelescopedProps<UndoButtonState>`), mirroring the
 * board/tray slice derivations in `useAppViewModel.ts` — a snapshot of the
 * current move-history depth plus the magnified child telescope. Lived here in
 * the shell rather than in `useAppViewModel.ts` because Phase 10's scope is
 * limited to `App.tsx` plus the `UndoButton` component files.
 */
function useUndoSlice(
  props: Readonly<TelescopedProps<AppState>>,
): TelescopedProps<UndoButtonState> {
  return useMemo(
    () => ({
      state: { placedMoves: props.state.game.placedCells.length },
      telescope: props.telescope.magnify(UNDO_BUTTON_LENS),
    }),
    [props.state.game, props.telescope],
  );
}

/* -------------------------------------------------------------------------- */
/* RenderApp                                                                  */
/* -------------------------------------------------------------------------- */

function RenderApp(props: {
  readonly viewModel: Readonly<AppViewModel>;
  readonly undo: TelescopedProps<UndoButtonState>;
  readonly actions: Readonly<AppActions>;
}): React.ReactElement {
  const { viewModel, undo, actions } = props;
  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: "44rem", mx: "auto" }}>
      <RenderTopBar topBar={viewModel.topBar} undo={undo} />
      <AppBoardTray viewModel={viewModel} />
      <RenderInvalidMoveSnackbar
        open={viewModel.snackbarOpen}
        onClose={actions.onInvalidMoveSnackbarClose}
      />
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
 * state (§5.6's `DragHint`) lands in Phase 14. The Undo button (Phase 10) and the
 * solvability icon are derived from state.
 */
function RenderTopBar(props: {
  readonly topBar: Readonly<TopBarView>;
  readonly undo: TelescopedProps<UndoButtonState>;
}): React.ReactElement {
  const { topBar, undo } = props;
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
          {/*
           * Phase 10: the Undo slot is now the child component proper. Enabled/disabled
           * and click handling live entirely in `UndoButton` + its slice (§5.7/§8.4
           * — the only empty-`placedCells` guard); this shell just places it.
           */}
          <UndoButton {...undo} />
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

/**
 * §5.12 (Phase 11): the invalid-move feedback. Renders only while the shell state's
 * `invalidMoveSnackbarOpen` flags the last placement attempt as rejected — opened by
 * the drag-end path in `useAppDomain.resolveDragDrop` (a `placePiece` throw, §3.5),
 * read through `useAppViewModel`'s `snackbarOpen` projection — so this function owns
 * no UI state of its own: a pure projection of shell state plus the shell's close
 * action. `autoHideDuration={6000}` auto-hides after 6 seconds; the same `onClose` is
 * handed to BOTH the `Snackbar` (its auto-hide/click-away/Escape dismissal — MUI only
 * runs the auto-hide timer at all when `onClose` is present) and the `Alert` (whose
 * close button MUI does not wire to the Snackbar's callback), and both routes commit
 * the dismissal through the shell telescope.
 */
function RenderInvalidMoveSnackbar(props: {
  readonly open: boolean;
  readonly onClose: () => void;
}): React.ReactElement {
  const { open, onClose } = props;
  return (
    <Snackbar open={open} autoHideDuration={6000} onClose={onClose}>
      <Alert severity="error" onClose={onClose} sx={{ width: "100%" }}>
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
