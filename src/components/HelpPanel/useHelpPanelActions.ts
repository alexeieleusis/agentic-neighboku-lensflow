import { useCallback } from "react";
import type { HelpPanelStateInternal } from "./useHelpPanelState.ts";
import { resolvePieceByLabel } from "./useHelpPanelDomain.ts";

export interface HelpPanelActions {
  /**
   * §5.10 item 1: the piece selector's `onChange` — the raw option value is a
   * digit label (or `""` for the no-selection option); it is resolved to a
   * candidate-space piece (or `null`) and committed to the state tier's
   * local selection.
   */
  readonly onPieceSelect: (label: string) => void;
}

/**
 * The action tier (requirements §7.2.1, docs/CONVENTIONS.md): one event-handler
 * closure per user interaction — the piece selector's `onChange`. It curries
 * the pure `resolvePieceByLabel` with the state tier's current candidate space
 * and commits the result to the state tier's local `selectedPiece` — no
 * business logic lives in the closure.
 *
 * Unlike this repo's telescope-committing actions (the shell's drop/undo
 * commits, the preferences panel's toggle commits), the commit target here is
 * the panel's LOCAL selection, not the slice: no `HelpPanelState` field moves
 * with a selection, so the handler just sets the state tier's value, exactly
 * like the shell's `onPreferencesToggle` / `onGameFinishedDialogClose` flip
 * their local UI flags without touching the telescope. (Consequently the hook
 * takes no `TelescopedProps` — it has no slice state or telescope to curry.)
 */
export function useHelpPanelActions(
  internal: Readonly<HelpPanelStateInternal>,
): HelpPanelActions {
  const onPieceSelect = useCallback(
    (label: string) => {
      internal.setSelectedPiece(
        resolvePieceByLabel(internal.candidatePieces, label),
      );
    },
    [internal],
  );

  return { onPieceSelect };
}
