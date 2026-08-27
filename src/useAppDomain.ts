import type {
  AppPreferences,
  AppState,
  HintPreferences,
  PieceType,
} from "./App.types.ts";
import type { AvailablePiecesTrayState } from "./components/AvailablePiecesTray/AvailablePiecesTray.types.ts";
import type {
  BoardDisplayState,
  BoardRow,
} from "./components/BoardDisplay/BoardDisplay.types.ts";
import type { BoardCell } from "./components/CellDisplay/CellDisplay.types.ts";
import { PIECE_TYPES } from "./components/CellDisplay/CellDisplay.types.ts";
import { cellFromDroppableId } from "./components/CellDisplay/useCellDisplayDomain.ts";
import { pieceFromDraggableId } from "./components/DraggablePiece/useDraggablePieceDomain.ts";
import type { DragHint } from "./components/DraggablePiece/DraggablePiece.types.ts";
import type { SolvabilityIconState } from "./components/SolvabilityIcon/SolvabilityIcon.types.ts";
import type { Piece } from "./game/entities";
import { isSamePiece } from "./game/entities";
import { cellIndex, placePiece, stateIsValid } from "./game/gameBuilder.ts";
import type { Game } from "./game/gameBuilder.ts";

/**
 * §5.6 / Phase 8 — the shell's pure tier (requirements §7.2.1): no React, no telescope
 * imports. Holds the board/tray state-slice derivations (moved here from `App.tsx` when
 * the shell's hook split landed) and the drag-drop resolution: current state plus the
 * two ids a drag-end event carries in, next state out.
 */

/**
 * Flatten a frozen `Board` into Phase 5's `BoardDisplayState`: one `BoardRow` per
 * board row, cells in column order, plus the app-level `pieceType` the shell owns
 * (requirements §4.2) that cells forward to their droppable targets — and, since
 * Phase 12 (§5.2), the move engine's `cellToFitPieces` fit cache and the two hint
 * preferences, forwarded so the cells' fit-count/hover hints derive from the shared
 * cache rather than recomputing fit legality.
 */
export function buildBoardDisplayState(
  game: Game,
  preferences: AppPreferences,
): BoardDisplayState {
  const rows: BoardRow[] = [];
  for (let row = 0; row < game.size; row++) {
    const cells: BoardCell[] = [];
    for (let col = 0; col < game.size; col++) {
      cells.push({ row, col, piece: game.board[row][col] });
    }
    rows.push({ index: row, cells });
  }
  return {
    size: game.size,
    pieceType: preferences.pieceType,
    cellToFitPieces: game.cellToFitPieces,
    hintFitPieceCount: preferences.hints.fitPieceCount,
    showFitPiecesOnHover: preferences.hints.showFitPiecesOnHover,
    rows,
  };
}

/**
 * The tray slice the `AvailablePiecesTray` renders AND commits through (§5.5,
 * Phase 13): the move engine's `Game` in its entirety — the render path reads its
 * `size`/`availablePieces`/`pieceToFitCells`, and the tray's click-to-place action
 * hands a `(piece, cell)` to Phase 3's `placePiece`, which needs the whole game to
 * produce the next one — plus the two tray-scoped hint flags the columns gate their
 * `*` and button list on (§4.2 `hintAvailablePieceUniqueCell` / `hintPieceCells`).
 */
export function buildAvailablePiecesTrayState(
  game: Game,
  hints: Pick<HintPreferences, "availablePieceUniqueCell" | "pieceCells">,
): AvailablePiecesTrayState {
  return {
    game,
    availablePieceUniqueCell: hints.availablePieceUniqueCell,
    pieceCells: hints.pieceCells,
  };
}

/**
 * The two dnd-kit ids a drag-end event carries, reduced to plain strings: the id the
 * shell registered the dragged tray piece under (`DraggablePiece`'s `useDraggable`
 * encoding, `useDraggablePieceDomain.ts`) and the id of the droppable the pointer
 * released over (`CellDisplay`'s `useDroppable` cell id, `useCellDisplayDomain.ts`;
 * `null` when the pointer is not over any registered droppable).
 */
export interface DragDropEventIds {
  readonly activeId: string;
  readonly overId: string | null;
}

/**
 * §5.6 / §5.12 (Phase 11): the shared drop path. Reads the dropped piece's value and
 * the target cell off the drag event's ids and commits through `placePiece` — the same
 * move-engine call Phase 13's click-to-place will use. Every unplaced outcome returns
 * the input state unchanged (same reference, so no stream re-emission):
 *   - dropped outside any droppable (`overId` is `null`) → no-op;
 *   - an id that does not parse as a cell / a tray piece / a held tray value → no-op.
 * The one outcome the shell reacts to beyond the engine: an illegal placement with
 * `preventInvalidMoves` (the default, §4.2) makes `placePiece` throw (§3.5 step 2 — and
 * the §3.5 out-of-bounds precondition — before touching any state) and the throw is
 * absorbed here with no partial mutation; the next state is the input state with only
 * `invalidMoveSnackbarOpen` set (§5.12) — `game` keeps its reference, so a rejected
 * attempt changes nothing but the invalid-move feedback the shell now opens.
 *
 * §5.8 (Phase 16): the engine consults its own NARROW `GamePreferences` (seeded at
 * game build), so the shell hands it a game whose narrow `preventInvalidMoves`
 * mirrors the shell's LIVE §4.2 preference: the Preferences panel's "Prevent
 * Invalid Moves" switch steers the running game on the very next drop — the
 * §5.12 feedback path is driven by the switch, end to end, not by the value
 * that happened to be stored at load time. The mirror is safe both ways: with
 * the switch off, an illegal drop is applied and recorded `isValid: false`
 * (§3.5) instead of throwing; the carried-over narrow value keeps the next
 * game in lockstep until the next toggle. Click-to-place (Phase 13) needs no
 * mirror: every tray button is a legal target by construction, so the §3.5
 * guard can never fire on that path.
 */
export function resolveDragDrop(
  state: AppState,
  event: Readonly<DragDropEventIds>,
): AppState {
  if (event.overId === null) return state;
  const cell = cellFromDroppableId(event.overId);
  if (cell === null) return state;
  const piece = resolveTrayPiece(
    state.game,
    pieceFromDraggableId(event.activeId),
  );
  if (piece === null) return state;
  try {
    return {
      ...state,
      game: placePiece(piece, cell, {
        ...state.game,
        preferences: {
          preventInvalidMoves: state.preferences.preventInvalidMoves,
        },
      }),
    };
  } catch {
    return { ...state, invalidMoveSnackbarOpen: true };
  }
}

/* -------------------------------------------------------------------------- */
/* Phase 14 — §5.6 drag-fit hint state machine                                 */
/* -------------------------------------------------------------------------- */

/**
 * §5.6 / Phase 14 — the shell's drag-lifecycle event, reduced to the plain fields the
 * `DragHint` state machine reads, one discriminated member per dnd-kit monitor event
 * the shell observes (`onDragStart` / `onDragOver` / `onDragEnd` / `onDragCancel`):
 *   - `start` / `end` / `cancel` carry no ids — the hint after them does not depend on
 *     which piece or target was involved, only that the drag began / finished / was
 *     cancelled;
 *   - `over` carries the two ids the event reports: the dragged piece's `useDraggable`
 *     id and the droppable the pointer currently hovers (`null` while hovering none).
 */
export type DragLifecycleEvent =
  | { readonly kind: "start" }
  | {
      readonly kind: "over";
      readonly activeId: string;
      readonly overId: string | null;
    }
  | { readonly kind: "end" }
  | { readonly kind: "cancel" };

/**
 * §5.6 / Phase 14: the `DragHint` the shell should hold after the given drag-lifecycle
 * event. This is the whole hint state machine, as a pure projection of shell state +
 * event onto the four-value union (requirements §5.6, §5.11 `hintFitOnDrag` row):
 *
 *   - `start`          → `"Unknown"`: the drag is in progress and dnd-kit has reported
 *                        no hovered target yet.
 *   - `end` / `cancel` → `"None"`: no drag is in progress anymore.
 *   - `over`           → `"Unknown"` whenever the hint cannot be determined — the
 *                        pointer hovers no registered droppable target (`overId` is
 *                        `null`, including hovering a filled cell, which is not a
 *                        droppable), `preferences.hints.fitOnDrag` is off (Ok/NotOk are
 *                        only ever produced while it is on), or either id does not
 *                        resolve to a real tray piece / in-bounds cell; else `"Ok"` when
 *                        the hovered target is a legal placement for the dragged piece
 *                        and `"NotOk"` when it is not.
 *
 * Legality reads the move engine's CURRENT `pieceToFitCells` cache — the exact same
 * source `placePiece` consults (§3.5 step 1) — so the hint can never disagree with the
 * drop: a target the hint calls `"Ok"` is one `placePiece` will accept, and one it
 * calls `"NotOk"` is one `placePiece` will reject (given `preventInvalidMoves`). The
 * cache is keyed over the tray's interned `Piece` references (§8.7), so the active id's
 * digits are resolved back to the tray's own key via `resolveTrayPiece` before lookup.
 */
export function resolveDragHint(
  state: AppState,
  event: Readonly<DragLifecycleEvent>,
): DragHint {
  switch (event.kind) {
    case "start":
      return "Unknown";
    case "end":
    case "cancel":
      return "None";
    case "over":
      if (event.overId === null) return "Unknown";
      if (!state.preferences.hints.fitOnDrag) return "Unknown";
      return dragHintOverTarget(state, event.activeId, event.overId);
  }
}

/**
 * The `over`-event branch of {@link resolveDragHint}: the hint while the dragged piece
 * hovers a registered droppable target with `fitOnDrag` on. `"Unknown"` for any target
 * the ids do not resolve to a real in-bounds cell holding a real tray piece (defensive:
 * only board cells register as droppables and only tray pieces as draggables, so these
 * ids always resolve in practice); else the cache lookup's `"Ok"`/`"NotOk"`.
 */
function dragHintOverTarget(
  state: AppState,
  activeId: string,
  overId: string,
): DragHint {
  const cell = cellFromDroppableId(overId);
  if (cell === null) return "Unknown";
  const [row, col] = cell;
  // An out-of-bounds "cell" id is not a registered droppable either (§3.5 preconditions
  // mirror at the domain boundary): the hint stays undetermined rather than "fits".
  if (row < 0 || row >= state.game.size || col < 0 || col >= state.game.size) {
    return "Unknown";
  }
  const piece = resolveTrayPiece(state.game, pieceFromDraggableId(activeId));
  if (piece === null) return "Unknown";
  const fittingCells = state.game.pieceToFitCells.get(piece) ?? [];
  return fittingCells.includes(cellIndex(state.game.size, row, col))
    ? "Ok"
    : "NotOk";
}

/**
 * §5.12 (Phase 11): the invalid-move feedback's dismissal. MUI fires this through the
 * shell's action tier from either dismissal source — the Snackbar's own `onClose`
 * (the 6-second auto-hide timeout, click-away, Escape) or the Alert's `onClose` (its
 * close button, which MUI does not wire to the Snackbar's callback) — all of them
 * meaning “the shell should now record the feedback as closed”. No-op (input reference
 * back, no stream re-emission) when the feedback is already closed.
 */
export function closeInvalidMoveSnackbar(state: AppState): AppState {
  if (!state.invalidMoveSnackbarOpen) return state;
  return { ...state, invalidMoveSnackbarOpen: false };
}

/* -------------------------------------------------------------------------- */
/* Phase 15 — §3.6/§5.13 game-finished & solvability-indicator derivations     */
/* -------------------------------------------------------------------------- */

/**
 * §3.6 / Phase 15: the game is finished exactly when the tray is empty. This reads
 * `availablePieces.size` — the move engine drops a tray entry the moment its count
 * reaches zero (§3.5 step 3), so a distinct-value count of zero is the same as a
 * remaining-unit count of zero: no piece value can remain to be placed. This is the
 * finished-ness derivation the shell's finished-game Dialog is built on; the Dialog
 * opens on this transition and stays closed at every other tray state, including a
 * fresh New Game (whose tray always holds pieces, §3.4's unfolding always blanks at
 * least one cell of a real board).
 */
export function isTrayEmpty(game: Game): boolean {
  return game.availablePieces.size === 0;
}

/**
 * §5.13 / Phase 15: the finished-game success alert's elapsed-time string, formatted
 * exactly `{h}h {m}m {s}s` (e.g. `0h 2m 15s`) — whole hours/minutes/seconds, no
 * padding, truncated (never rounded up) to the whole second. `totalMs` is the
 * duration in milliseconds; a negative input (clock skew: "now" ahead of a
 * back-dated `startTime` is the only realistic case, and it cannot produce a
 * negative elapsed time) clamps to zero rather than formatting a minus sign.
 */
export function formatElapsed(totalMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, totalMs) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

/**
 * §5.13 / Phase 15: the App → `SolvabilityIcon` slice — the two booleans the
 * top-bar indicator renders from, both derived upstream in the shell: the §4.2
 * `hints.gameIsSolvable` preference (visibility) and Phase 3's `stateIsValid`
 * result on `game` (the §3.6 solvability — this function consumes the move
 * engine's existing result, it does not recompute or duplicate any of its
 * conditions). The non-trivial part of §5.13's indicator lives here, in the
 * shell; `SolvabilityIcon` itself only maps these two booleans to its icon.
 *
 * Focused arguments, like the other slice builders (`buildBoardDisplayState`,
 * `buildAvailablePiecesTrayState`): the two inputs the slice actually reads,
 * not the whole `AppState`.
 */
export function buildSolvabilityIconState(
  game: Game,
  hintGameIsSolvable: boolean,
): SolvabilityIconState {
  return {
    visible: hintGameIsSolvable,
    solvable: stateIsValid(game),
  };
}

/**
 * The tray's interned `Piece` reference whose digits are `digits` (`null` when the tray
 * holds no such value). `placePiece`'s `Map` lookups are by reference (§8.7), so a
 * freshly-parsed digit array must be resolved back to the tray's own key before it can
 * drive a placement — this is that resolution.
 */
export function resolveTrayPiece(
  game: Game,
  digits: readonly number[] | null,
): Piece | null {
  if (digits === null) return null;
  for (const piece of game.availablePieces.keys()) {
    if (isSamePiece(piece, digits)) return piece;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Phase 16 — §4.3/§8.5 stored-preferences reconciliation                      */
/* -------------------------------------------------------------------------- */

/**
 * §4.3 — the load-time merge of a stored preferences blob over the §4.2
 * defaults: every stored field that arrives with a shape the `AppPreferences`
 * type accepts wins, and every missing, partial, or malformed field falls
 * back to its default — so a missing key, an empty stored object, or a
 * stored object from an older/partial preferences shape all resolve to a
 * fully-populated, correctly-typed `AppPreferences` without throwing.
 * `stored` is the parsed `localStorage` value (`undefined` when the key is
 * absent or the blob is unparseable JSON); this function is the pure core of
 * `main.tsx`'s load path and performs no storage access itself.
 *
 * §8.5: `scalars.dimension` is forced to `3` in the result regardless of what
 * value (if any) the stored blob carried — reproduced exactly as observed in
 * the original, not "fixed" or reconciled with `NewGamePanel`'s
 * size-dependent rule (Phase 17 scope): always `3` on load, full stop.
 */
export function mergeStoredPreferences(
  defaults: AppPreferences,
  stored: unknown,
): AppPreferences {
  const s = isPreferencesRecord(stored) ? stored : {};
  const scalars = isPreferencesRecord(s.scalars) ? s.scalars : {};
  const hints = isPreferencesRecord(s.hints) ? s.hints : {};
  return {
    scalars: {
      base: positiveIntOr(defaults.scalars.base, scalars.base),
      // §8.5 (above): the unconditional load-time override.
      dimension: 3,
      size: positiveIntOr(defaults.scalars.size, scalars.size),
    },
    pieceType: pieceTypeOr(defaults.pieceType, s.pieceType),
    hints: {
      fitPieceCount: booleanOr(
        defaults.hints.fitPieceCount,
        hints.fitPieceCount,
      ),
      pieceCells: booleanOr(defaults.hints.pieceCells, hints.pieceCells),
      fitOnDrag: booleanOr(defaults.hints.fitOnDrag, hints.fitOnDrag),
      showFitPiecesOnHover: booleanOr(
        defaults.hints.showFitPiecesOnHover,
        hints.showFitPiecesOnHover,
      ),
      availablePiecesCount: booleanOr(
        defaults.hints.availablePiecesCount,
        hints.availablePiecesCount,
      ),
      availablePieceUniqueCell: booleanOr(
        defaults.hints.availablePieceUniqueCell,
        hints.availablePieceUniqueCell,
      ),
      gameIsSolvable: booleanOr(
        defaults.hints.gameIsSolvable,
        hints.gameIsSolvable,
      ),
    },
    preventInvalidMoves: booleanOr(
      defaults.preventInvalidMoves,
      s.preventInvalidMoves,
    ),
    sound: booleanOr(defaults.sound, s.sound),
  };
}

/**
 * A non-null, non-array object — the only shape a stored preferences blob can
 * take and still carry fields; anything else (a missing key, a JSON string or
 * number, `null`, an array) is treated as "no stored preferences".
 */
function isPreferencesRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `value` when it is a boolean, else `fallback` — a malformed stored flag never poisons a default. */
function booleanOr(fallback: boolean, value: unknown): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * `value` when it is a positive integer, else `fallback`: the board builders
 * `RangeError` on non-positive or non-integral scalars (§3.1/§3.3), so a
 * malformed stored scalar falls back to its default rather than crashing the
 * first board build after load.
 */
function positiveIntOr(fallback: number, value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

/** `value` when it is one of the `PieceType` literals, else `fallback` — a corrupted stored skin falls back rather than mis-rendering every face. Membership is checked against `PIECE_TYPES`, the single source of truth for the accepted skins, so a new skin flows through this guard without drift. */
function pieceTypeOr(fallback: PieceType, value: unknown): PieceType {
  return (PIECE_TYPES as readonly unknown[]).includes(value)
    ? (value as PieceType)
    : fallback;
}
