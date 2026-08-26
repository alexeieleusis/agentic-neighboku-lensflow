import { useEffect, useState } from "react";
import type { TelescopedProps } from "./base/TelescopeComponent.ts";
import type { AppState } from "./App.types.ts";
import { stateIsValid } from "./game/gameBuilder.ts";
import { isTrayEmpty } from "./useAppDomain.ts";

/** How often the shell's duration timer advances its "now" (Phase 15, §5.13). */
const TICK_MS = 1000;

/**
 * The internal (state-tier) shape `useAppState` returns to the orchestrator
 * (`useAppViewModel`) and the action tier (`useAppActions`) — includes the
 * dismissal setter, which the orchestrator strips before the public view model
 * reaches `RenderApp` (docs/CONVENTIONS.md split-hook rule: component-external
 * consumers only ever see public state).
 *
 * The three booleans are independent facts, not the facets of one state
 * machine: `trayEmpty` and `solvable` are derived game predicates that happen
 * to be true/false at any given moment (§3.6's two separate questions — is
 * the game finished? is it solvable? — which are simultaneously true at a
 * finished-solvable end state and simultaneously false at a mid-game
 * position), and `dialogDismissed` is the shell's own UI flag that is only
 * meaningful while `trayEmpty`. A discriminated union would force
 * `trayEmpty × solvable × dialogDismissed` into a single enum whose members
 * conflate the game state with the UI state — worse, not better.
 */
// eslint-disable-next-line lensflow/no-parallel-boolean-state-flags
export interface AppInternalState {
  /**
   * The duration timer's "now" (epoch ms), advanced every `TICK_MS` by the
   * shell's own interval. Ticks for the whole shell lifetime, including across a
   * completed game — inert there: the finished-game Dialog's elapsed string is
   * `finishedElapsedMs` (frozen at the tray-emptying moment), not a live
   * `now − gamePlay.startTime` difference.
   */
  readonly now: number;
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
}

/**
 * The shell's state tier (requirements §7.2.1, Phase 15): local, non-telescope
 * UI state plus values derived from the shell telescope's current state via the
 * pure `useAppDomain` functions. Two pieces of local state live here and nowhere
 * else (never ad hoc in `App.tsx`):
 *
 *   - the duration timer: a ticking "now" on a 1-second interval — the
 *     §5.13 elapsed string is the difference between the tray-emptying
 *     moment and `gamePlay.startTime` (the timer's origin, shell-owned since
 *     no New Game reset exists yet — Phase 17 will add it), captured once at
 *     the emptying moment and held static for the Dialog's open lifetime
 *     (`finishedElapsedMs`), never read live off the ticking "now";
 *   - the finished-game Dialog's dismissal: local UI state, because the
 *     dismissed-but-tray-still-empty condition is the player's recovery window
 *     (§5.13) and is not shell-wide state worth persisting on `AppState`.
 *
 * The derived booleans (`trayEmpty`, `solvable`) are domain projections of the
 * current shell state; `dialogOpen` itself is computed by the orchestrator from
 * them plus the local dismissal flag.
 */
export function useAppState(
  props: Readonly<TelescopedProps<AppState>>,
): AppInternalState {
  const { game, gamePlay } = props.state;

  // The duration timer: ticks "now" every second for the shell's whole lifetime.
  // `setInterval` (not a recursive `setTimeout`) keeps the period steady; the
  // cleanup clears it on unmount, and StrictMode's double-invoke just re-arms
  // the same interval.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

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

  return {
    now,
    trayEmpty,
    solvable: stateIsValid(game),
    dialogDismissed,
    setDialogDismissed,
    finishedElapsedMs,
  };
}
