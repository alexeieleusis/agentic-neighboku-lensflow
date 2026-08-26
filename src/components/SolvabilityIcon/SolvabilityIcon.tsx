import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type {
  SolvabilityIconState,
  SolvabilityIconViewModel,
} from "./SolvabilityIcon.types";
import { useSolvabilityIconViewModel } from "./useSolvabilityIconViewModel";

/**
 * §5.13 (Phase 15) — the top bar's solvability indicator: the happy/sad-face
 * (§5.1) `CheckCircle` / `ReportProblem` icons the shell previously inlined in
 * `RenderTopBar`, now a standalone fractal component — `state,telescope →
 * useSolvabilityIconViewModel → RenderSolvabilityIcon` (requirements §7.2) — so
 * the happy/sad-face-vs-hidden logic is independently testable and swappable,
 * consistent with `UndoButton` (Phase 10) and `DragFitHintIcon` (Phase 14).
 *
 * The state slice is the shell's `{ visible, solvable }` on its own dedicated
 * magnified telescope (`App` → `SolvabilityIcon`, §7.2 — `SOLVABILITY_ICON_LENS`):
 * the non-trivial part of §5.13 (reading the `hintGameIsSolvable` preference and
 * consuming Phase 3's `gameIsSolvable` result) lives upstream in the shell and is
 * passed down through that telescope — never recomputed here, and never as raw
 * callback props. The component itself is a trivial leaf: it maps the two
 * booleans to its icon (or to nothing, when the preference is off).
 *
 * §5.1: the indicator is a purely decorative signal — no click handler — and
 * re-announces its state politely (`aria-live`), exactly as the shell's inline
 * version did.
 *
 * The component function's return type is widened to `React.ReactElement | null`
 * (rather than the `TelescopeComponent` alias's bare `React.ReactElement`)
 * because §5.13's third rendering state — the preference off — renders NOTHING:
 * the hidden indicator contributes no DOM node at all, not even an empty
 * placeholder. The fractal data flow (`state,telescope → useXViewModel →
 * RenderX`) is otherwise unchanged.
 */
export const SolvabilityIcon = (
  props: TelescopedProps<SolvabilityIconState>,
): React.ReactElement | null => {
  return RenderSolvabilityIcon(useSolvabilityIconViewModel(props));
};

function RenderSolvabilityIcon(
  viewModel: Readonly<SolvabilityIconViewModel>,
): React.ReactElement | null {
  // §5.13: nothing is shown when the preference is off — the hidden state is a
  // real third rendering state, not just a flag on the other two.
  if (!viewModel.visible) return null;

  // §5.1: `CheckCircle` (solvable) vs. `ReportProblem` (unsolvable), in the
  // semantic success/error theme colors, announced politely. The `aria-live`
  // region is a persistent wrapper span so that face-to-face label changes
  // (solvable ↔ unsolvable) are re-announced: the live region itself survives
  // the child icon swap.
  return (
    <span aria-live="polite">
      {viewModel.solvable ? (
        <CheckCircleIcon
          titleAccess={viewModel.ariaLabel}
          sx={{ color: viewModel.color, p: 0.5 }}
        />
      ) : (
        <ReportProblemIcon
          titleAccess={viewModel.ariaLabel}
          sx={{ color: viewModel.color, p: 0.5 }}
        />
      )}
    </span>
  );
}
