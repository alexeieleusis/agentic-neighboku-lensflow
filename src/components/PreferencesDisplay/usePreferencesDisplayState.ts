import { useMemo } from "react";
import type { PieceType } from "../CellDisplay/CellDisplay.types.ts";
import type { TelescopedProps } from "../../base/TelescopeComponent.ts";
import type {
  PreferencesDisplayState,
  BooleanPreferenceKey,
} from "./PreferencesDisplay.types.ts";
import {
  BOOLEAN_PREFERENCE_ROWS,
  PIECE_TYPE_ROW_LABEL,
  getBooleanPreference,
} from "./usePreferencesDisplayDomain.ts";

/**
 * One row's state-tier data: the static spec (kind, label, and — for the
 * boolean rows — the §5.8 preference key the row drives) plus the row's
 * CURRENT value read off the magnified slice. No commit closures here: the
 * action tier's handlers are joined on by the orchestrator, which keeps the
 * state tier's public surface value-only (docs/CONVENTIONS.md split-hook
 * rule: internal shapes may carry more than the public view model, but the
 * other way around is where setters leak).
 */
/** Row metadata shared by both members: every row carries a display label. */
interface PreferencesDisplayRowValueBase {
  readonly label: string;
}

export type PreferencesDisplayRowValue =
  | (PreferencesDisplayRowValueBase & {
      readonly kind: "switch";
      readonly key: BooleanPreferenceKey;
      readonly checked: boolean;
    })
  | (PreferencesDisplayRowValueBase & {
      readonly kind: "segmented";
      readonly key: "pieceType";
      readonly value: PieceType;
    });

export interface PreferencesDisplayStateInternal {
  readonly rows: readonly PreferencesDisplayRowValue[];
}

/**
 * The state tier of Phase 16's non-trivial split (requirements §7.2.1,
 * docs/CONVENTIONS.md): the 9 rows' current values derived from the magnified
 * telescope's current state via the pure domain tier — one `pieceType` row
 * plus the 8 boolean rows, each row's value read through
 * `getBooleanPreference` / the direct `pieceType` field, in §5.8's exact
 * table order. This component holds no local non-telescope UI state of its
 * own (the drawer's open/closed flag is the SHELL's local state, in
 * `useAppState.ts` — §5.8's boundary note), so the memo recomputes the row
 * list exactly when the preferences slice itself moves: `props.state` is a
 * fresh `AppPreferences` reference on every slice emission, and its identity
 * tracks every field the derivation reads.
 */
export function usePreferencesDisplayState(
  props: Readonly<TelescopedProps<PreferencesDisplayState>>,
): PreferencesDisplayStateInternal {
  const rows = useMemo<PreferencesDisplayRowValue[]>(
    () => [
      {
        kind: "segmented",
        key: "pieceType",
        label: PIECE_TYPE_ROW_LABEL,
        value: props.state.pieceType,
      },
      ...BOOLEAN_PREFERENCE_ROWS.map((row) => ({
        kind: "switch" as const,
        key: row.key,
        label: row.label,
        checked: getBooleanPreference(props.state, row.key),
      })),
    ],
    [props.state],
  );

  return { rows };
}
