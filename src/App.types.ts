import type { TelescopedProps } from "./base/TelescopeComponent.ts";
import type { Game } from "./game/gameBuilder.ts";
import type { PieceType } from "./components/CellDisplay/CellDisplay.types.ts";
import type { BoardDisplayState } from "./components/BoardDisplay/BoardDisplay.types.ts";
import type { AvailablePiecesTrayState } from "./components/AvailablePiecesTray/AvailablePiecesTray.types.ts";

/**
 * The two visual skins for the shared attribute space (requirements §1, §5.4). A user
 * preference toggled via the Preferences panel (Phase 16); the actual Shapes/Faces
 * rendering is Phase 6/Phase 19. The type itself is defined at the Phase 5 leaf
 * (`CellDisplay.types.ts`, its first consumer) and imported here bottom-up so the
 * component type graph stays acyclic.
 */
export type { PieceType } from "./components/CellDisplay/CellDisplay.types.ts";

/** The §4.2 scalar sub-object of the wide preferences. */
export interface PreferenceScalars {
  readonly base: number;
  readonly dimension: number;
  readonly size: number;
}

/**
 * §4.2 hint toggles for the “does it fit” preview. Independent user preferences
 * (defaults enable several at once — see `defaultPreferences` in `main.tsx`), not
 * mutually exclusive states — so they stay parallel booleans rather than a
 * discriminated union (UC13 “When Not to Use It”: independent simple flags).
 */
// eslint-disable-next-line lensflow/no-parallel-boolean-state-flags
export interface FitHintFlags {
  readonly fitPieceCount: boolean;
  readonly pieceCells: boolean;
  readonly fitOnDrag: boolean;
  readonly showFitPiecesOnHover: boolean;
}

/** §4.2 hint toggles for the available-pieces tray. */
export interface AvailableHintFlags {
  readonly availablePiecesCount: boolean;
  readonly availablePieceUniqueCell: boolean;
}

/** §4.2 hint toggle for the solvability indicator. */
export interface SolvabilityHintFlag {
  readonly gameIsSolvable: boolean;
}

/** §4.2 hint toggles, nested under `AppPreferences`'s single `hints` member. */
export type HintPreferences = FitHintFlags &
  AvailableHintFlags &
  SolvabilityHintFlag;

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
  /**
   * The Phase 5 board slice: `BoardDisplayState` plus a magnified child telescope
   * (`App` → `BoardDisplay`, §7.2). Read-only in this phase — board writes flow
   * through the move engine once placement exists (Phase 8).
   */
  readonly board: TelescopedProps<BoardDisplayState>;
  /**
   * The Phase 7 tray slice: `AvailablePiecesTrayState` plus a magnified child telescope
   * (`App` → `AvailablePiecesTray`, §7.2). Read-only in this phase — tray writes flow
   * through the move engine once placement exists (Phase 8).
   */
  readonly tray: TelescopedProps<AvailablePiecesTrayState>;
  readonly topBar: TopBarView;
  readonly snackbarOpen: boolean;
  readonly dialogOpen: boolean;
}
