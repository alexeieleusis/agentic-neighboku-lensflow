import type { Game } from "./game/gameBuilder.ts";
import type { Piece } from "./game/entities.ts";

/**
 * The two visual skins for the shared attribute space (requirements §1, §5.4). A user
 * preference toggled via the Preferences panel (Phase 16); the actual Shapes/Faces
 * rendering is Phase 6/Phase 19, so Phase 4 only stores this value.
 */
export type PieceType = "Shapes" | "Faces";

/** The §4.2 scalar sub-object of the wide preferences. */
export interface PreferenceScalars {
  readonly base: number;
  readonly dimension: number;
  readonly size: number;
}

/** §4.2 hint toggles, nested under `AppPreferences`'s single `hints` member. */
export interface HintPreferences {
  readonly fitPieceCount: boolean;
  readonly pieceCells: boolean;
  readonly fitOnDrag: boolean;
  readonly showFitPiecesOnHover: boolean;
  readonly availablePiecesCount: boolean;
  readonly availablePieceUniqueCell: boolean;
  readonly gameIsSolvable: boolean;
}

/**
 * The wide, user-facing preferences (requirements §4.2). Distinct from the domain
 * `Game`'s narrow `GamePreferences` (which only carries `preventInvalidMoves`): the
 * move-engine reads a subset, the app owns the full set that is persisted (Phase 16).
 */
export interface AppPreferences {
  readonly scalars: PreferenceScalars;
  readonly pieceType: PieceType;
  readonly hints: HintPreferences;
  readonly preventInvalidMoves: boolean;
  readonly sound: boolean;
}

/**
 * Root shell state (requirements §5.1, §7.3). `game` is the Phase 1–3 move-engine `Game`;
 * everything else is app-shell-owned and is never persisted (only `preferences` is, later).
 */
export interface AppState {
  /** A real, freshly-unfolded Phase 3 `Game` produced by `buildBoard` + `unfoldGame`. */
  readonly game: Game;
  readonly preferences: AppPreferences;
  /** §5.13/§5.12 invalid-move overlay: closed by default; Phase 11 opens it. */
  readonly invalidMoveSnackbarOpen: boolean;
  /** §3.6/§5.13 game-finished overlay: closed by default; Phase 15 drives it. */
  readonly gameFinishedDialogOpen: boolean;
}

/* -------------------------------------------------------------------------- */
/* View-model shapes consumed by RenderApp                                     */
/* -------------------------------------------------------------------------- */

/** One board cell, bare-bones for Phase 4 (piece as a digit vector, not yet styled). */
export interface BoardCellView {
  readonly row: number;
  readonly col: number;
  readonly piece: Piece | null;
}

/** The board as a flat, ordered list of cells (row-major) plus its square size. */
export interface BoardView {
  readonly size: number;
  readonly cells: readonly BoardCellView[];
}

/** One tray column: a distinct remaining piece value and how many copies remain. */
export interface TrayColumnView {
  readonly piece: Piece;
  readonly count: number;
}

/** The placeholder-level tray (full tray columns land in Phase 7). */
export interface TrayView {
  readonly columns: readonly TrayColumnView[];
}

/** The top-bar solvability indicator (requirements §5.1, §5.13). */
export interface SolvabilityView {
  readonly visible: boolean;
  readonly solvable: boolean;
}

/** The state-dependent bits of the top bar (the rest is inert this phase). */
export interface TopBarView {
  readonly undoEnabled: boolean;
  readonly solvability: SolvabilityView;
}

/** Everything `RenderApp` needs, precomputed by `useAppViewModel`. */
export interface AppViewModel {
  readonly board: BoardView;
  readonly tray: TrayView;
  readonly topBar: TopBarView;
  readonly snackbarOpen: boolean;
  readonly dialogOpen: boolean;
}
