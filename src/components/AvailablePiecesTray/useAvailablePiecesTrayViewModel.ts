import type { TelescopedProps } from "../../base/TelescopeComponent";
import type {
  AvailablePiecesTrayState,
  AvailablePiecesTrayViewModel,
} from "./AvailablePiecesTray.types";
import { useAvailablePiecesTrayActions } from "./useAvailablePiecesTrayActions";
import { useAvailablePiecesTrayState } from "./useAvailablePiecesTrayState";

/**
 * Orchestrator hook (requirements §7.2.1): composes Phase 13's non-trivial split —
 * the state tier (`useAvailablePiecesTrayState`: the column list derived from the
 * magnified telescope's current state via the pure domain tier) and the actions
 * tier (`useAvailablePiecesTrayActions`: the click-to-place commit handler) — and
 * stays wiring-only. Phase 13's click-to-place is a genuine user action with a
 * telescope commit path, which is what moves this component from Phase 7's flat
 * view model onto docs/CONVENTIONS.md's Domain/State/Actions/ViewModel layout.
 */
export function useAvailablePiecesTrayViewModel(
  props: Readonly<TelescopedProps<AvailablePiecesTrayState>>,
): AvailablePiecesTrayViewModel {
  const { columns } = useAvailablePiecesTrayState(props);
  const { onPlacePiece } = useAvailablePiecesTrayActions(props);

  return { columns, onPlacePiece };
}
