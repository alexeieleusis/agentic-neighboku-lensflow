import type { TelescopedProps } from "../../base/TelescopeComponent.ts";
import type {
  NewGamePanelState,
  NewGamePanelViewModel,
} from "./NewGamePanel.types.ts";
import { useNewGamePanelActions } from "./useNewGamePanelActions.ts";
import { useNewGamePanelState } from "./useNewGamePanelState.ts";
import { BOARD_SIZES } from "./useNewGamePanelDomain.ts";

/**
 * Orchestrator hook (requirements §7.2.1, docs/CONVENTIONS.md's non-trivial
 * scale rule): composes Phase 17's split — the state tier
 * (`useNewGamePanelState`: the pending board-size selection, §5.9's
 * first-open default of 8×8 plus §4.1's prior-dimension read) and the
 * actions tier (`useNewGamePanelActions`: the select's change handler and
 * the Start commit) — and stays wiring-only: it joins the pure tier's
 * size spec with the local selection and the two handlers into the view
 * model `RenderNewGamePanel` renders straight to its select + Start
 * button. No business logic of its own: the SIZES, the size→dimension
 * RULE, and the INITIAL dimension all live in the pure domain tier, and
 * the COMMITS all live in the actions tier.
 *
 * §5.9's "one Board Size select and a Start button" makes the panel's
 * public surface deliberately small even though the underlying state
 * (the §4.1 rule + the §5.9 rebuild/unfold/reset/close commit) is
 * non-trivial — hence the full Domain/State/Actions/ViewModel layout
 * rather than a single flat hook.
 */
export function useNewGamePanelViewModel(
  props: Readonly<TelescopedProps<NewGamePanelState>>,
): NewGamePanelViewModel {
  const internal = useNewGamePanelState(props);
  const actions = useNewGamePanelActions(props, internal);

  return {
    sizes: BOARD_SIZES,
    selectedSize: internal.selection.size,
    onSizeChange: actions.onSizeChange,
    onStart: actions.onStart,
  };
}
