import { useMemo } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent.ts";
import type {
  PreferencesDisplayState,
  PreferencesDisplayViewModel,
  PreferencesDisplayRow,
} from "./PreferencesDisplay.types.ts";
import { usePreferencesDisplayActions } from "./usePreferencesDisplayActions.ts";
import { usePreferencesDisplayState } from "./usePreferencesDisplayState.ts";
import { PIECE_TYPE_OPTIONS } from "./usePreferencesDisplayDomain.ts";

/**
 * Orchestrator hook (requirements §7.2.1, docs/CONVENTIONS.md's non-trivial
 * scale rule): composes Phase 16's split — the state tier
 * (`usePreferencesDisplayState`: the 9 rows' current values derived from the
 * magnified telescope's current state via the pure domain tier) and the
 * actions tier (`usePreferencesDisplayActions`: the two commit handlers) —
 * and stays wiring-only: it joins each row's static spec + current value with
 * its own commit closure into the row list `RenderPreferencesDisplay` maps
 * straight to its 9 rows. No business logic of its own: the row ORDER, LABELS,
 * KEY MAPPING, and UPDATE RULES all live in the pure domain tier, and the
 * COMMITS all live in the actions tier.
 *
 * With 9 mutually independent controls (§5.8), this component is non-trivial
 * by docs/CONVENTIONS.md's scale rule (real user actions + the load/persist
 * side effects the slice feeds), hence the full
 * Domain/State/Actions/ViewModel layout rather than a single flat hook.
 */
export function usePreferencesDisplayViewModel(
  props: Readonly<TelescopedProps<PreferencesDisplayState>>,
): PreferencesDisplayViewModel {
  const { rows: rowValues } = usePreferencesDisplayState(props);
  const actions = usePreferencesDisplayActions(props);

  const rows = useMemo<PreferencesDisplayRow[]>(
    () =>
      rowValues.map((row) =>
        row.kind === "switch"
          ? {
              kind: "switch" as const,
              label: row.label,
              checked: row.checked,
              // This control's own commit closure: the shared actions-tier
              // handler curried with this row's §5.8 preference key.
              onChange: (checked: boolean) =>
                actions.onBooleanChange(row.key, checked),
            }
          : {
              kind: "segmented" as const,
              label: row.label,
              value: row.value,
              options: PIECE_TYPE_OPTIONS,
              onChange: actions.onPieceTypeChange,
            },
      ),
    [rowValues, actions],
  );

  return { rows };
}
