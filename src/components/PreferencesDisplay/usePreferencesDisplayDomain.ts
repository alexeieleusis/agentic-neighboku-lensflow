import type { AppPreferences } from "../../App.types.ts";
import type { PieceType } from "../CellDisplay/CellDisplay.types.ts";
import { PIECE_TYPES } from "../CellDisplay/CellDisplay.types.ts";
import type { BooleanPreferenceKey } from "./PreferencesDisplay.types.ts";

/**
 * §5.8 — the pure tier of this component's fractal split (requirements §7.2.1,
 * docs/CONVENTIONS.md): no React, no telescope imports. Highest-priority tier
 * of the testing pyramid (requirements §7.5) — see
 * __tests__/usePreferencesDisplayDomain.test.ts.
 *
 * Holds the panel's 9-row spec (§5.8's table: labels, order, and which §4.2
 * preference each row drives — the requirements' flat key names map onto this
 * codebase's nested `AppPreferences`) and the pure per-control update
 * functions the action tier curries: given the current preferences object and
 * a control's new value, the next preferences object with that one field
 * changed and every other field untouched.
 */

/**
 * The 8 boolean rows in §5.8's exact table order (the `pieceType` row
 * precedes them in the panel; it is a categorical control, not a boolean, so
 * it specs itself below). `label` is the table's exact label text.
 */
export const BOOLEAN_PREFERENCE_ROWS: readonly {
  readonly key: BooleanPreferenceKey;
  readonly label: string;
}[] = [
  { key: "hintFitPieceCount", label: "Hint Fit Piece Count" },
  { key: "hintAvailablePieceUniqueCell", label: "Hint Fit Piece Unique Cell" },
  { key: "hintPieceCells", label: "Hint Piece Cells" },
  { key: "hintFitOnDrag", label: "Hint Fit On Drag" },
  { key: "showFitPiecesOnHover", label: "Show Fit Pieces on Hover" },
  { key: "preventInvalidMoves", label: "Prevent Invalid Moves" },
  { key: "hintGameIsSolvable", label: "Hint Game Is Solvable" },
  { key: "sound", label: "Sound" },
];

/** §5.8 table's exact label for the `pieceType` row. */
export const PIECE_TYPE_ROW_LABEL = "Piece Type: Shapes or Faces";

/** The §5.8 `pieceType` options, in display order — the `PIECE_TYPES` constant (the single source of truth for the accepted skins), not a redeclared array. */
export const PIECE_TYPE_OPTIONS: readonly PieceType[] = PIECE_TYPES;

/**
 * The getter half of the boolean-row key table: reads the §4.2 field one §5.8
 * row drives off the preferences (the requirement's flat key names map onto
 * this codebase's nested shape — the 6 hint flags live under `hints`,
 * `preventInvalidMoves` and `sound` at the top level).
 */
const BOOLEAN_GETTERS: Record<
  BooleanPreferenceKey,
  (preferences: AppPreferences) => boolean
> = {
  hintFitPieceCount: (p) => p.hints.fitPieceCount,
  hintAvailablePieceUniqueCell: (p) => p.hints.availablePieceUniqueCell,
  hintPieceCells: (p) => p.hints.pieceCells,
  hintFitOnDrag: (p) => p.hints.fitOnDrag,
  showFitPiecesOnHover: (p) => p.hints.showFitPiecesOnHover,
  preventInvalidMoves: (p) => p.preventInvalidMoves,
  hintGameIsSolvable: (p) => p.hints.gameIsSolvable,
  sound: (p) => p.sound,
};

/**
 * The setter half of the boolean-row key table: one fresh preferences object
 * with exactly that row's field set to `value` — every other field (including
 * the sibling hint flags) keeps the value the input held, which is the 9
 * controls' mutual independence (§5.8: "all mutually independent").
 */
const BOOLEAN_SETTERS: Record<
  BooleanPreferenceKey,
  (preferences: AppPreferences, value: boolean) => AppPreferences
> = {
  hintFitPieceCount: (p, v) => ({
    ...p,
    hints: { ...p.hints, fitPieceCount: v },
  }),
  hintAvailablePieceUniqueCell: (p, v) => ({
    ...p,
    hints: { ...p.hints, availablePieceUniqueCell: v },
  }),
  hintPieceCells: (p, v) => ({ ...p, hints: { ...p.hints, pieceCells: v } }),
  hintFitOnDrag: (p, v) => ({ ...p, hints: { ...p.hints, fitOnDrag: v } }),
  showFitPiecesOnHover: (p, v) => ({
    ...p,
    hints: { ...p.hints, showFitPiecesOnHover: v },
  }),
  preventInvalidMoves: (p, v) => ({ ...p, preventInvalidMoves: v }),
  hintGameIsSolvable: (p, v) => ({
    ...p,
    hints: { ...p.hints, gameIsSolvable: v },
  }),
  sound: (p, v) => ({ ...p, sound: v }),
};

/** The current value of one boolean row's §4.2 preference. */
export function getBooleanPreference(
  preferences: AppPreferences,
  key: BooleanPreferenceKey,
): boolean {
  return BOOLEAN_GETTERS[key](preferences);
}

/**
 * The next preferences after one boolean row's control writes `value`: the
 * input object with exactly that row's field set and every other field
 * untouched. A write of the value the row already holds returns the INPUT
 * reference — so the control's commit no-ops through the telescope's
 * distinctUntilChanged'd stream (no re-emission, no re-persistence), exactly
 * like the shell's own no-op guards (`resolveDragDrop`, `DRAG_HINT_LENS`).
 */
export function setBooleanPreference(
  preferences: AppPreferences,
  key: BooleanPreferenceKey,
  value: boolean,
): AppPreferences {
  if (getBooleanPreference(preferences, key) === value) return preferences;
  return BOOLEAN_SETTERS[key](preferences, value);
}

/**
 * The next preferences after the `pieceType` row's control selects
 * `pieceType` (the §5.8 "Shapes"/"Faces" choice, written as the string value
 * per §5.8's correction note — a categorical control, not a boolean). Same
 * no-op contract as {@link setBooleanPreference}: re-selecting the value
 * already held returns the input reference.
 */
export function setPieceType(
  preferences: AppPreferences,
  pieceType: PieceType,
): AppPreferences {
  if (preferences.pieceType === pieceType) return preferences;
  return { ...preferences, pieceType };
}
