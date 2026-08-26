import type { TelescopedProps } from "../../base/TelescopeComponent";
import type {
  SolvabilityIconState,
  SolvabilityIconViewModel,
} from "./SolvabilityIcon.types";

/**
 * §5.13 (Phase 15) — the accessibility label each visible indicator state
 * announces from the top-bar slot, matching the §5.1 wording the shell's
 * inline version already shipped.
 */
const ARIA_LABEL = {
  solvable: "Position is solvable",
  unsolvable: "No solution exists",
} as const;

/**
 * §5.13 (Phase 15) — the MUI theme color token each visible indicator state
 * paints in: the semantic success/error colors the shell's solvability icon
 * already used.
 */
const COLOR = {
  solvable: "success.main",
  unsolvable: "error.main",
} as const;

/**
 * Trivial tier (requirements §7.2.1, docs/CONVENTIONS.md scale rule): a simple
 * leaf with no real state/action complexity keeps one flat view-model hook —
 * no Domain/State/Actions split. The component only maps the two slice booleans
 * it reads off its dedicated telescope to a label + color: it holds no local
 * UI state and owns no user-triggered action of its own. The non-trivial part of
 * §5.13 — computing `gameIsSolvable` (Phase 3's `stateIsValid`, consumed, never
 * recomputed) and reading the `hintGameIsSolvable` preference — lives upstream
 * in the shell's telescope state and is passed down through the slice, not
 * derived here.
 */
export function useSolvabilityIconViewModel(
  props: Readonly<TelescopedProps<SolvabilityIconState>>,
): SolvabilityIconViewModel {
  const { visible, solvable } = props.state;
  return {
    visible,
    solvable,
    ariaLabel: visible
      ? solvable
        ? ARIA_LABEL.solvable
        : ARIA_LABEL.unsolvable
      : "",
    color: solvable ? COLOR.solvable : COLOR.unsolvable,
  };
}
