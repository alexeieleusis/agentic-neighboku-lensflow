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
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Drawer from "@mui/material/Drawer";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import SettingsIcon from "@mui/icons-material/Settings";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import HelpIcon from "@mui/icons-material/Help";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "./base/TelescopeComponent.ts";
import type { AppPreferences, AppState, AppViewModel } from "./App.types.ts";
import type { DragHint } from "./components/DraggablePiece/DraggablePiece.types.ts";
import { undoPlay } from "./game/gameBuilder.ts";
import { useAppViewModel } from "./useAppViewModel.ts";
import { BoardDisplay } from "./components/BoardDisplay/BoardDisplay.tsx";
import { AvailablePiecesTray } from "./components/AvailablePiecesTray/AvailablePiecesTray.tsx";
import { UndoButton } from "./components/UndoButton/UndoButton.tsx";
import type { UndoButtonState } from "./components/UndoButton/UndoButton.types.ts";
import { DragFitHintIcon } from "./components/DragFitHintIcon/DragFitHintIcon.tsx";
import { PreferencesDisplay } from "./components/PreferencesDisplay/PreferencesDisplay.tsx";
import { SolvabilityIcon } from "./components/SolvabilityIcon/SolvabilityIcon.tsx";
import type { SolvabilityIconState } from "./components/SolvabilityIcon/SolvabilityIcon.types.ts";
import { NewGamePanel } from "./components/NewGamePanel/NewGamePanel.tsx";
import type { NewGamePanelState } from "./components/NewGamePanel/NewGamePanel.types.ts";

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
 * contract, requirements §7.2) and the Phase 10 undo slice (`useUndoSlice` — the App →
 * `UndoButton` §7.2 magnification).
 *
 * The action tier (`useAppActions`) runs INSIDE `useAppViewModel` since Phase 15: the
 * orchestrator must share its state tier's dismissal flag with the action tier (one
 * source of truth for the finished-game Dialog's local dismissal, §5.13), so the
 * action closures no longer travel to `RenderApp` as a separate argument — the two
 * user-invoked ones (the invalid-move Snackbar dismissal, §5.12; the finished-game
 * Dialog dismissal, §5.13) are precomputed fields of the view model (§7.2: event-
 * handler closures live in the view model, not the render function). The drag-
 * lifecycle monitor (`useDndMonitor`'s `onDragStart`/`onDragOver`/`onDragEnd`/
 * `onDragCancel` — the shared placement path, §5.6, and the Phase 14 `DragHint`
 * commits) registers itself with the shell-level `DndContext` from within the view
 * model, still a true descendant of `<DndContext>` (docs/CONVENTIONS.md dnd-kit note).
 */
function AppConnected(
  props: Readonly<TelescopedProps<AppState>>,
): React.ReactElement {
  const viewModel = useAppViewModel(props);
  const undo = useUndoSlice(props);
  return RenderApp({ viewModel, undo });
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
}): React.ReactElement {
  const { viewModel, undo } = props;
  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: "44rem", mx: "auto" }}>
      <RenderTopBar
        undo={undo}
        dragHint={viewModel.dragHint}
        solvability={viewModel.solvability}
        preferencesDrawerOpen={viewModel.preferencesDrawerOpen}
        onPreferencesToggle={viewModel.onPreferencesToggle}
        newGameDrawerOpen={viewModel.newGameDrawerOpen}
        onNewGameToggle={viewModel.onNewGameToggle}
      />
      <AppBoardTray viewModel={viewModel} />
      <RenderInvalidMoveSnackbar
        open={viewModel.snackbarOpen}
        onClose={viewModel.onInvalidMoveSnackbarClose}
      />
      <RenderGameFinishedDialog
        open={viewModel.dialogOpen}
        success={viewModel.dialogSuccess}
        elapsed={viewModel.dialogElapsed}
        onClose={viewModel.onGameFinishedDialogClose}
      />
      <RenderPreferencesDrawer
        open={viewModel.preferencesDrawerOpen}
        onClose={viewModel.onPreferencesDrawerClose}
        preferences={viewModel.preferences}
      />
      <RenderNewGameDrawer
        open={viewModel.newGameDrawerOpen}
        onClose={viewModel.onNewGameDrawerClose}
        newGame={viewModel.newGame}
      />
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/* Top bar                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * §5.1 top bar. The six elements are in this exact fixed order, per the shell spec:
 * drag-fit-hint icon, Preferences button, New Game button, Undo button, solvability
 * icon, Help button. The drag-fit-hint icon (Phase 14) is the child component proper —
 * it reads the §5.6 `DragHint` off its own dedicated magnified telescope
 * (`dragHint`, the App → `DragFitHintIcon` slice) and renders the info /
 * thumbs-up / thumbs-down states from it; this shell just places it in the slot Phase 4
 * reserved. The solvability icon (Phase 15) is likewise the child component proper —
 * `SolvabilityIcon` reads the §5.13 `{ visible, solvable }` slice off its own
 * dedicated magnified telescope and renders the happy face, the sad face, or nothing
 * from it; the §3.6 solvability result and the §4.2 preference are derived upstream
 * in the shell and passed down through that slice, never recomputed in this bar. The
 * Preferences button (Phase 16) toggles the bottom preferences drawer; the New Game
 * button (Phase 17) toggles the bottom New Game drawer the same way; the Help button
 * is still an inert placeholder (Phase 18); the Undo button (Phase 10) is derived
 * from state.
 */
function RenderTopBar(props: {
  readonly undo: TelescopedProps<UndoButtonState>;
  readonly dragHint: TelescopedProps<DragHint>;
  readonly solvability: TelescopedProps<SolvabilityIconState>;
  readonly preferencesDrawerOpen: boolean;
  readonly onPreferencesToggle: () => void;
  readonly newGameDrawerOpen: boolean;
  readonly onNewGameToggle: () => void;
}): React.ReactElement {
  const {
    undo,
    dragHint,
    solvability,
    preferencesDrawerOpen,
    onPreferencesToggle,
    newGameDrawerOpen,
    onNewGameToggle,
  } = props;

  return (
    <AppBar position="static" sx={{ px: 1 }}>
      <Toolbar variant="dense">
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {/*
           * Phase 14: the drag-fit-hint slot is now the child component proper. It
           * reads the §5.6 `DragHint` off its own dedicated magnified telescope
           * (`dragHint`, the App → `DragFitHintIcon` slice) and renders the info /
           * thumbs-up / thumbs-down states from it; the hint's writes come from the
           * shell's drag-lifecycle monitor, never through this shell.
           */}
          <DragFitHintIcon {...dragHint} />
          {/*
           * Phase 16: the Preferences slot is now wired — the gear icon toggles the
           * bottom drawer (the `RenderPreferencesDrawer` overlay below, §5.8)
           * through the shell's action tier; its open state is shell-local UI
           * state, announced to assistive tech via `aria-expanded`.
           */}
          <Tooltip title="Preferences">
            <IconButton
              size="small"
              aria-label="Preferences"
              aria-haspopup="dialog"
              aria-expanded={preferencesDrawerOpen}
              onClick={onPreferencesToggle}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          {/*
           * Phase 17: the New Game slot is now wired — the RestartAlt icon
           * toggles the bottom New Game drawer (the `RenderNewGameDrawer`
           * overlay below, §5.9) through the shell's action tier. Unlike the
           * Phase 16 Preferences button, its open state is shell-owned
           * `AppState` (the panel's Start commit also writes it, §5.9),
           * announced to assistive tech via `aria-expanded`.
           */}
          <Tooltip title="New Game">
            <IconButton
              size="small"
              aria-label="New Game"
              aria-haspopup="dialog"
              aria-expanded={newGameDrawerOpen}
              onClick={onNewGameToggle}
            >
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
          {/*
           * Phase 10: the Undo slot is now the child component proper. Enabled/disabled
           * and click handling live entirely in `UndoButton` + its slice (§5.7/§8.4
           * — the only empty-`placedCells` guard); this shell just places it.
           */}
          <UndoButton {...undo} />
          {/*
           * Phase 15: the solvability slot is now the child component proper. The
           * happy/sad-face-vs-hidden logic lives entirely in `SolvabilityIcon` + its
           * slice (§5.13 — the §3.6 solvability result and the §4.2 preference are
           * derived upstream in the shell and passed down through the dedicated
           * telescope); this shell just places it in the slot Phase 4 reserved.
           */}
          <SolvabilityIcon {...solvability} />
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

/**
 * §3.6/§5.13 (Phase 15): the game-finished overlay. Open state is a pure derivation
 * of shell state (`dialogOpen` — the tray empty, §3.6, and not dismissed), so this
 * function owns no UI state of its own: a projection of the view model plus the
 * shell's close action. While open it shows exactly one alert:
 *   - success — `severity="success"` (MUI v9's `MuiAlert-colorSuccess` class; both
 *     severities root at `role="alert"`), carrying the §5.13 elapsed-time string
 *     `{h}h {m}m {s}s` (`dialogElapsed` — the duration captured at the moment the
 *     tray emptied, frozen for the Dialog's open lifetime, not a live timer)
 *     when `gameIsSolvable` held as the tray emptied;
 *   - failure — `severity="error"` (`MuiAlert-colorError`) only, with no
 *     elapsed-time string, when the position is not solvable.
 * The sad face / failure alert are informational only (§5.13): no forced-undo
 * mechanic exists — `onClose` (MUI's Escape / backdrop-click dismissal) merely
 * dismisses the overlay so the player can reach Undo and run the video's recovery
 * loop ("press undo until the happy face reappears"); Undo itself stays driven
 * solely by Phase 10's `placedCells`-empty guard.
 */
function RenderGameFinishedDialog(props: {
  readonly open: boolean;
  readonly success: boolean;
  readonly elapsed: string;
  readonly onClose: () => void;
}): React.ReactElement {
  const { open, success, elapsed, onClose } = props;
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Game finished</DialogTitle>
      <DialogContent>
        {success ? (
          <Alert severity="success" sx={{ width: "100%" }}>
            Solved in {elapsed}
          </Alert>
        ) : (
          <Alert severity="error" sx={{ width: "100%" }}>
            No solution exists for this position.
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * §5.8 (Phase 16): the bottom preferences drawer. `open` is shell-local UI
 * state (the `useAppState` tier), so this function owns no state of its own: a
 * MUI `Drawer` anchored to the bottom (§5.8) whose content is the
 * `PreferencesDisplay` component proper, handed the §4.2 `preferences` slice as
 * its own magnified telescope (`App` → `PreferencesDisplay`, §7.2) — the 9
 * controls read and write that slice directly, and every change reaches the
 * shell (and `main.tsx`'s per-emission persistence, §4.3) through the
 * `PREFERENCES_LENS` setter. Dismissal (backdrop click / Escape) fires MUI's
 * `onClose`, the shell's `onPreferencesDrawerClose` action.
 */
function RenderPreferencesDrawer(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly preferences: TelescopedProps<AppPreferences>;
}): React.ReactElement {
  const { open, onClose, preferences } = props;
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { maxHeight: "80vh", overflowY: "auto" } } }}
    >
      <PreferencesDisplay {...preferences} />
    </Drawer>
  );
}

/**
 * §5.9 (Phase 17): the bottom New Game drawer. `open` is shell-owned
 * `AppState` (`newGameDrawerOpen`) — not local UI state like the Phase 16
 * preferences drawer's flag — because the panel's Start commit writes it
 * too (§5.9 "and closes the panel" is part of the panel's single
 * slice-telescope write), so this function owns no state of its own: a MUI
 * `Drawer` anchored to the bottom (§5.9) whose content is the
 * `NewGamePanel` component proper, handed the §4.1/§5.9 slice as its own
 * magnified telescope (`App` → `NewGamePanel`, §7.2) — the Board Size
 * select reads and the Start button commits through that slice directly,
 * never through shell callbacks. Dismissal (backdrop click / Escape) fires
 * MUI's `onClose`, the shell's `onNewGameDrawerClose` action.
 */
function RenderNewGameDrawer(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly newGame: TelescopedProps<NewGamePanelState>;
}): React.ReactElement {
  const { open, onClose, newGame } = props;
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { maxHeight: "80vh", overflowY: "auto" } } }}
    >
      <NewGamePanel {...newGame} />
    </Drawer>
  );
}
