import { useCallback } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type {
  CounterDisplayState,
  CounterDisplayViewModel,
} from "./CounterDisplay.types";

/**
 * Trivial tier (requirements.md §7.2.1): a simple leaf component keeps one flat
 * view-model hook, no Domain/State/Actions split. Compare with FaceSwatchBoard's split
 * hooks for the non-trivial tier.
 */
export function useCounterDisplayViewModel(
  props: Readonly<TelescopedProps<CounterDisplayState>>,
): CounterDisplayViewModel {
  const increment = useCallback(() => {
    props.telescope.update({ count: props.state.count + 1 });
  }, [props.telescope, props.state.count]);

  return {
    count: props.state.count,
    increment,
  };
}
