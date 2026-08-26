/**
 * §5.13 (Phase 15) — the complete state slice for the top bar's solvability
 * indicator: the §4.2 `hintGameIsSolvable` preference (whether the indicator
 * shows at all) and the §3.6 solvability of the current position (which face it
 * shows). Both are derived UPSTREAM in the shell — the preference read and
 * Phase 3's `stateIsValid` result — and flow down through the dedicated App →
 * `SolvabilityIcon` magnified telescope (`SOLVABILITY_ICON_LENS`,
 * `useAppViewModel.ts`), so this component maps two booleans to an icon and
 * never recomputes solvability itself.
 */
export interface SolvabilityIconState {
  /** §4.2: the `hints.gameIsSolvable` preference — `false` renders nothing at all. */
  readonly visible: boolean;
  /** §3.6: Phase 3's `stateIsValid` on the current game — the happy vs. sad face. */
  readonly solvable: boolean;
}

/**
 * §5.13 (Phase 15) — everything `RenderSolvabilityIcon` needs, precomputed by
 * `useSolvabilityIconViewModel`: the two slice booleans (passed through for the
 * icon choice) plus the MUI presentation the two map onto — the accessibility
 * label the slot announces (and re-announces, `aria-live`) and the theme color
 * token the icon paints in.
 */
export interface SolvabilityIconViewModel {
  /** The slice's visibility flag — `false` renders nothing (§5.13: "nothing is shown when the preference is off"). */
  readonly visible: boolean;
  /** The slice's solvability flag — picks the face when visible. */
  readonly solvable: boolean;
  /** The `aria-label` the indicator's slot announces. */
  readonly ariaLabel: string;
  /** The MUI theme color token the icon paints in (`success.main` / `error.main`). */
  readonly color: string;
}
