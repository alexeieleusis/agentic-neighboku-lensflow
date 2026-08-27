import { useCallback, useMemo } from "react";
import type { PieceType } from "../CellDisplay/CellDisplay.types.ts";
import type { TelescopedProps } from "../../base/TelescopeComponent.ts";
import type {
  PreferencesDisplayState,
  BooleanPreferenceKey,
} from "./PreferencesDisplay.types.ts";
import {
  setBooleanPreference,
  setPieceType,
} from "./usePreferencesDisplayDomain.ts";

export interface PreferencesDisplayActions {
  /**
   * The shared commit handler of the panel's 8 `Switch` rows: one closure for
   * every boolean control, receiving the row's §5.8 preference key and the
   * value the switch moved to — the same shared-parameterized shape as
   * `AvailablePiecesTray`'s `onPlacePiece(piece, cell)`.
   */
  readonly onBooleanChange: (
    key: BooleanPreferenceKey,
    checked: boolean,
  ) => void;
  /** The `pieceType` row's commit handler: the selected "Shapes"/"Faces" value. */
  readonly onPieceTypeChange: (pieceType: PieceType) => void;
}

/**
 * Event-handler closures only (requirements §7.2.1, docs/CONVENTIONS.md): each
 * action curries a `usePreferencesDisplayDomain` update function with the
 * current slice state/telescope, then commits via `telescope.update` — no
 * business logic lives directly in an action body, and no persistence lives
 * here either: this component only ever writes the in-memory
 * `AppPreferences` slice through its magnified telescope (§5.8's boundary
 * note), and `main.tsx`'s per-emission subscription is what persists it
 * (§4.3).
 *
 * Both commits are no-ops — same slice reference back, no re-emission, no
 * re-persistence — when the control's event leaves the value unchanged: the
 * domain functions return the input reference in that case (a doubled switch
 * event, or re-selecting the `pieceType` already held).
 *
 * The returned object is memoized on the two stable closures so the
 * orchestrator's row-list memo has stable dependencies across renders in
 * which the slice state and telescope did not move.
 */
export function usePreferencesDisplayActions(
  props: Readonly<TelescopedProps<PreferencesDisplayState>>,
): PreferencesDisplayActions {
  const { state, telescope } = props;

  const onBooleanChange = useCallback(
    (key: BooleanPreferenceKey, checked: boolean) => {
      telescope.update(setBooleanPreference(state, key, checked));
    },
    [state, telescope],
  );

  const onPieceTypeChange = useCallback(
    (pieceType: PieceType) => {
      telescope.update(setPieceType(state, pieceType));
    },
    [state, telescope],
  );

  return useMemo(
    () => ({ onBooleanChange, onPieceTypeChange }),
    [onBooleanChange, onPieceTypeChange],
  );
}
