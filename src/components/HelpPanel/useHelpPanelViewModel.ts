import { useMemo } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent.ts";
import type { HelpPanelState, HelpPanelViewModel } from "./HelpPanel.types.ts";
import { pieceLabel } from "./useHelpPanelDomain.ts";
import { useHelpPanelActions } from "./useHelpPanelActions.ts";
import { useHelpPanelState } from "./useHelpPanelState.ts";

/**
 * The orchestrator (requirements §7.2.1, docs/CONVENTIONS.md's non-trivial
 * scale rule): composes Phase 18's split — the state tier
 * (`useHelpPanelState`: the local piece selection plus the candidate /
 * valid / invalid piece sets derived from it via the pure domain tier) and
 * the action tier (`useHelpPanelActions`: the piece selector's `onChange`) —
 * and stays wiring-only: it strips the selection setter and joins the rest
 * into the view model `RenderHelpPanel` maps straight onto its six §5.10
 * sections. No business logic of its own: the set derivations live in the
 * domain tier, the selection and its reset in the state tier, the commit in
 * the action tier.
 */
export function useHelpPanelViewModel(
  props: Readonly<TelescopedProps<HelpPanelState>>,
): HelpPanelViewModel {
  const internal = useHelpPanelState(props);
  const actions = useHelpPanelActions(internal);

  // The closed selector's displayed value: the selection's digit label, or
  // the empty string (with the selector's `displayEmpty`) in the
  // no-selection state — precomputed here so the render function owns no
  // value→label mapping of its own.
  const selectedLabel = useMemo(
    () =>
      internal.selectedPiece === null ? "" : pieceLabel(internal.selectedPiece),
    [internal.selectedPiece],
  );

  return {
    candidatePieces: internal.candidateEntries,
    selectedPiece: internal.selectedPiece,
    selectedLabel,
    validNeighbors: internal.validEntries,
    invalidNeighbors: internal.invalidEntries,
    onPieceSelect: actions.onPieceSelect,
  };
}
