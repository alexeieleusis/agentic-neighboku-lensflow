import { useEffect, useState } from "react";
import type { TelescopedProps } from "./base/TelescopeComponent.ts";
import type { AppState } from "./App.types.ts";
import { stateIsValid } from "./game/gameBuilder.ts";
import { isTrayEmpty } from "./useAppDomain.ts";

/**
 * The internal (state-tier) shape `useAppState` returns to the orchestrator
 * (`useAppViewModel`) and the action tier (`useAppActions`) — includes the
 * dismissal setter, which the orchestrator strips before the public view model
 * reaches `RenderApp` (docs/CONVENTIONS.md split-hook rule: component-external
 * consumers only ever see public state).
 *
 * The booleans are independent facts, not the facets of one state
 * machine: `trayEmpty` and `solvable` are derived game predicates that happen
 * to be true/false at any given moment (§3.6's two separate questions — is
 * the game finished? is it solvable? — which are simultaneously true at a
 * finished-solvable end state and simultaneously false at a mid-game
 * position), `dialogDismissed` is the shell's own UI flag that is only
 * meaningful while `trayEmpty`, and `preferencesDrawerOpen` (Phase 16) and
 * `helpDrawerOpen` (Phase 18) are the two drawers' open/closed flags,
 * meaningful at every moment and independent of all the rest. A
 * discriminated union would force `trayEmpty × solvable × dialogDismissed ×
 * preferencesDrawerOpen × helpDrawerOpen` into a single enum whose members
 * conflate the game state with the UI state — worse, not better.
 */
// eslint-disable-next-line lensflow/no-parallel-boolean-state-flags
export interface AppInternalState {
  /** §3.6: whether the tray is empty — the finished-game Dialog's open trigger. */
  readonly trayEmpty: boolean;
  /**
   * §5.13: the finished-game Dialog's elapsed time in ms — captured as
   * `Date.now() − gamePlay.startTime` at the exact moment the tray empties and
   * frozen for the Dialog's whole open lifetime (the success alert's
   * `{h}h {m}m {s}s` string must be static, not a live counter), and reset to
   * `null` when the tray refills, so the next emptying captures a fresh value.
   */
  readonly finishedElapsedMs: number | null;
  /** §3.6: Phase 3's `stateIsValid` result on the current game (the §5.13 outcome). */
  readonly solvable: boolean;
  /**
   * The finished-game Dialog's dismissal (local, non-telescope UI state —
   * §7.2.1 names "dialog open/closed" as exactly this tier's kind of state):
   * set by the Dialog's close action while the tray is still empty, so the
   * player can reach Undo and run the §5.13 recovery loop ("press undo until
   * the happy face reappears"); reset when the tray refills, so the next
   * time the tray empties the Dialog opens again.
   */
  readonly dialogDismissed: boolean;
  readonly setDialogDismissed: (dismissed: boolean) => void;
  /**
   * §5.8 (Phase 16): the preferences drawer's open/closed flag — the shell's
   * local UI state (§7.2.1's "dialog open/closed"), opened by the top-bar gear
   * icon's toggle and closed by the drawer's own dismissal (backdrop click /
   * Escape) or the gear icon again. Not `AppState`: no preference or game field
   * moves with it.
   */
  readonly preferencesDrawerOpen: boolean;
  readonly setPreferencesDrawerOpen: (open: boolean) => void;
  /**
   * §5.10 (Phase 18): the help drawer's open/closed flag — the shell's local
   * UI state (§7.2.1's "dialog open/closed"), opened by the top-bar help
   * icon's toggle and closed by the drawer's own dismissal (backdrop click /
   * Escape) or the help icon again. Not `AppState`: no preference or game
   * field moves with it (the piece selected INSIDE the open drawer is the
   * panel's own local state, in `HelpPanel`'s `useHelpPanelState` tier).
   */
  readonly helpDrawerOpen: boolean;
  readonly setHelpDrawerOpen: (open: boolean) => void;
}

/**
 * The shell's state tier (requirements §7.2.1, Phase 15; extended at Phases
 * 16 and 18): local, non-telescope UI state plus values derived from the
 * shell telescope's current state via the pure `useAppDomain` functions.
 * Four pieces of local state live here and nowhere else (never ad hoc in
 * `App.tsx`):
 *
 *   - the finished-game Dialog's elapsed capture: `finishedElapsedMs`, the
 *     difference between the tray-emptying moment and `gamePlay.startTime`
 *     (the clock's origin, shell-owned since no New Game reset exists yet —
 *     Phase 17 will add it), read once off `Date.now()` at the emptying
 *     moment and held static for the Dialog's open lifetime. No ticking "now"
 *     is kept: the §5.13 string is a one-time capture whose only reader
 *     (`dialogElapsed`) never needs a live value;
 *   - the finished-game Dialog's dismissal: local UI state, because the
 *     dismissed-but-tray-still-empty condition is the player's recovery window
 *     (§5.13) and is not shell-wide state worth persisting on `AppState`;
 *   - the preferences drawer's open/closed flag (Phase 16, §5.8): local UI
 *     state for the same reason the Dialog's dismissal is — opening/closing
 *     the drawer moves no `AppState` field (no preference, no game), so it
 *     stays out of the telescope and simply flips on the gear icon's toggle
 *     and the drawer's own dismissal;
 *   - the help drawer's open/closed flag (Phase 18, §5.10): local UI state
 *     for exactly the same reason — it starts closed and is owned by no
 *     domain predicate, so it has no reset effect.
 *
 * The derived booleans (`trayEmpty`, `solvable`) are domain projections of the
 * current shell state; `dialogOpen` itself is computed by the orchestrator from
 * them plus the local dismissal flag.
 */
export function useAppState(
  props: Readonly<TelescopedProps<AppState>>,
): AppInternalState {
  const { game, gamePlay } = props.state;

  // The finished-game Dialog's dismissal: reset whenever the tray refills (the
  // only refill path is Undo, §5.7), so dismissal never outlives the empty tray
  // it was applied to.
  const trayEmpty = isTrayEmpty(game);
  const [dialogDismissed, setDialogDismissed] = useState(false);
  useEffect(() => {
    if (!trayEmpty) setDialogDismissed(false);
  }, [trayEmpty]);

  // §5.13: the elapsed-time capture — frozen at the moment the tray empties.
  // Render-time state adjustment (React's "store information from previous
  // renders" pattern), deliberately not an effect: the capture must land in the
  // SAME render that flips `trayEmpty`, so the Dialog's first paint already
  // shows the final value — an effect-based capture would settle a frame later
  // (the open Dialog would flash "0h 0m 0s" before jumping to the real value),
  // and a mount-time capture would flash it too. The setter fires at most once
  // per tray-empty ↔ tray-refill transition, so the induced re-render is a
  // single, intended one.
  const [finishedElapsedMs, setFinishedElapsedMs] = useState<number | null>(
    null,
  );
  if (trayEmpty !== (finishedElapsedMs !== null)) {
    setFinishedElapsedMs(trayEmpty ? Date.now() - gamePlay.startTime : null);
  }

  // §5.8 (Phase 16): the preferences drawer's open/closed flag — plain local
  // UI state, like the finished-game Dialog's dismissal: it starts closed and
  // is owned by no domain predicate, so it has no reset effect.
  const [preferencesDrawerOpen, setPreferencesDrawerOpen] = useState(false);

  // §5.10 (Phase 18): the help drawer's open/closed flag — plain local UI
  // state for the same reason (the piece selected inside the open drawer is
  // the panel's own local state, not the shell's).
  const [helpDrawerOpen, setHelpDrawerOpen] = useState(false);

  return {
    trayEmpty,
    solvable: stateIsValid(game),
    dialogDismissed,
    setDialogDismissed,
    finishedElapsedMs,
    preferencesDrawerOpen,
    setPreferencesDrawerOpen,
    helpDrawerOpen,
    setHelpDrawerOpen,
  };
}
