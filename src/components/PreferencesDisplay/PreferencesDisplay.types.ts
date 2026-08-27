import type { AppPreferences } from "../../App.types.ts";
import type { PieceType } from "../CellDisplay/CellDisplay.types.ts";

/**
 * §5.8 — the state slice this component reads AND writes: the shell's §4.2
 * `AppPreferences` in its entirety (imported, not redefined — the panel is a
 * view over the shell-owned slice, never a copy of it). The component's props
 * are `TelescopedProps<PreferencesDisplayState>`: the snapshot plus the
 * App → `PreferencesDisplay` magnified telescope (`PREFERENCES_LENS` in
 * `useAppViewModel.ts`) the 9 controls commit through.
 */
export type PreferencesDisplayState = AppPreferences;

/**
 * §5.8 — the preference key one of the panel's 8 boolean rows drives, in the
 * requirements' flat key naming (mapped onto this codebase's nested
 * `AppPreferences` fields by the domain tier's getter/setter tables).
 */
export type BooleanPreferenceKey =
  | "hintFitPieceCount"
  | "hintAvailablePieceUniqueCell"
  | "hintPieceCells"
  | "hintFitOnDrag"
  | "showFitPiecesOnHover"
  | "preventInvalidMoves"
  | "hintGameIsSolvable"
  | "sound";

/**
 * §5.8 — one panel row's view-model shape: its exact table label, its current
 * value read off the magnified slice, and its own commit closure (the action
 * tier's handler, wired by the orchestrator) so `RenderPreferencesDisplay`
 * owns no commit logic of its own.
 */
export interface PreferencesDisplaySwitchRow {
  readonly kind: "switch";
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

export interface PreferencesDisplaySegmentedRow {
  readonly kind: "segmented";
  readonly label: string;
  readonly value: PieceType;
  readonly options: readonly PieceType[];
  readonly onChange: (value: PieceType) => void;
}

export type PreferencesDisplayRow =
  PreferencesDisplaySwitchRow | PreferencesDisplaySegmentedRow;

/** Everything `RenderPreferencesDisplay` needs, precomputed by `usePreferencesDisplayViewModel`. */
export interface PreferencesDisplayViewModel {
  /**
   * The 9 rows in §5.8's exact table order — the `pieceType` row first, then the
   * 8 `Switch` rows — each fully self-describing (label + current value + its
   * own `onChange`).
   */
  readonly rows: readonly PreferencesDisplayRow[];
}
