# Phase 15 — Solvability indicator & game-finished dialog

## Scope (files this phase may create/modify)
- src/App.tsx
- src/App.types.ts
- src/useAppDomain.ts
- src/useAppState.ts
- src/useAppActions.ts
- src/useAppViewModel.ts
- src/components/SolvabilityIcon/SolvabilityIcon.tsx
- src/components/SolvabilityIcon/SolvabilityIcon.types.ts
- src/components/SolvabilityIcon/useSolvabilityIconViewModel.ts
- src/components/SolvabilityIcon/SolvabilityIcon.stories.tsx

## Requirements

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §3.6 (Win / loss detection), quoted verbatim in full:

> ### 3.6 Win / loss detection
>
> The game is considered **solvable** (`gameIsSolvable`) iff all three hold simultaneously:
> every placed move so far has `isValid: true`, every blank cell has at least one piece
> that could fit it, and every remaining tray piece has at least one cell it could fit.
> When the tray becomes empty (`availablePieces.size === 0`), the game-finished dialog is
> shown, using `gameIsSolvable` to pick a success or failure state.

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.13 (Solvability indicator and game-finished dialog), quoted verbatim in full:

> ### 5.13 Solvability indicator and game-finished dialog
>
> - If `hintGameIsSolvable` is on, the top bar shows a happy-face icon when
>   `gameIsSolvable` (§3.6) is true, a sad-face icon otherwise; nothing is shown when the
>   preference is off.
> - When the tray empties, a Dialog appears: success alert with an elapsed-time string
>   (`{h}h {m}m {s}s` since the game started) if solvable, a failure alert if not. The
>   video's guidance ("press undo until the happy face reappears") describes the intended
>   player recovery loop when the sad face is showing — no forced-undo mechanic exists,
>   it's purely a hint.

**Boundary this phase must implement (not part of the literal excerpts above):**
`gameIsSolvable` itself is Phase 3 scope (`game/gameBuilder.ts`, per
`docs/phases/03-move-engine.md`) and is already fully implemented and unit-tested there,
including all three simultaneous conditions from §3.6 above. This phase does not
reimplement or duplicate that logic — it only **consumes** the existing `gameIsSolvable`
result (and `availablePieces.size`) from the current `Game` state to drive UI: the top-bar
`SolvabilityIcon`, the finished-game `Dialog`, and a duration timer measured from
`gamePlay.startTime` (established by Phase 4's app shell / Phase 17's New Game panel reset
of `startTime`, whichever already exists at this point in the phase sequence) to "now."

`App`'s own view-model logic is re-evaluated against `docs/CONVENTIONS.md`'s scale rule as
part of this phase: prior phases (11, 14) kept `App`'s hook(s) in whatever form they left
them in (a flat `useAppViewModel.ts`, per Phase 11's `src/useApp*.ts` scope wildcard, is an
acceptable starting point). This phase adds real component-local business rules to
`App` — deriving the finished/not-finished Dialog state from `availablePieces.size`,
formatting the `{h}h {m}m {s}s` elapsed-time string from `gamePlay.startTime`, and running a
duration timer — which are exactly the kind of derived-value/business-rule logic
`docs/CONVENTIONS.md`'s scale rule assigns to a non-trivial component. If `App`'s hooks are
still a single flat `useAppViewModel.ts` when this phase starts, split them now into
`useAppDomain.ts` (pure functions: elapsed-time formatting, finished/success/failure
derivation from `availablePieces.size` and `gameIsSolvable` — no React, no telescope
imports), `useAppState.ts` (the timer's local ticking state plus telescope-derived values
via the domain functions), `useAppActions.ts` (any new event-handler closures this phase
needs, e.g. closing the finished Dialog), and `useAppViewModel.ts` as the wiring-only
orchestrator — per §7.2.1's scale rule and `docs/CONVENTIONS.md`'s file-layout section. If
`App`'s hooks are already split by an earlier phase, extend the existing
domain/state/actions files rather than reintroducing a flat one.

`SolvabilityIcon` is a new, separate top-bar component (not inlined in `App.tsx`/`RenderApp`)
so the happy/sad-face-vs-hidden logic is independently testable and swappable, consistent
with how `UndoButton` (Phase 10) and the Phase 14 drag-fit-hint icon are each their own
top-bar component rather than inline JSX in `App`. Per `docs/CONVENTIONS.md`'s scale rule,
`SolvabilityIcon`'s own logic (pick happy-face icon vs. sad-face icon vs. render nothing,
based on two booleans) is trivial, so it keeps a single flat
`useSolvabilityIconViewModel.ts` with no domain/state/actions split of its own — the
non-trivial logic (computing `gameIsSolvable` and reading the `hintGameIsSolvable`
preference) lives upstream in `App`'s telescope state and is passed down, not recomputed
inside `SolvabilityIcon`.

## Acceptance criteria
- `App` consumes the existing `gameIsSolvable` result from Phase 3's `game/gameBuilder.ts` (which already correctly implements all three simultaneous §3.6 conditions: every entry in `placedCells` has `isValid: true`, every blank cell has at least one fitting piece per `cellToFitPieces`, every remaining tray piece has at least one fitting cell per `pieceToFitCells`) — this phase does not reimplement, duplicate, or recompute any of those three conditions inside `App.tsx`, `useAppDomain.ts`, or `SolvabilityIcon`.
- The top-bar `SolvabilityIcon` renders the happy-face icon when `hintGameIsSolvable` is `true` and `gameIsSolvable` is `true`, the sad-face icon when `hintGameIsSolvable` is `true` and `gameIsSolvable` is `false`, and renders nothing at all when `hintGameIsSolvable` is `false`, regardless of `gameIsSolvable`'s value.
- `SolvabilityIcon` occupies the solvability-icon slot in the top bar's observed order (drag-fit-hint icon, Preferences button, New Game button, Undo button, solvability icon, Help button — §5.1), consistent with Phase 4's shell layout.
- The finished-game `Dialog` opens exactly when `availablePieces.size === 0` (tray empty) and stays closed at every other tray state, including immediately after a fresh New Game start.
- **Success case** — when the `Dialog` opens with `gameIsSolvable` `true`, it shows a success-severity alert containing an elapsed-time string formatted exactly `{h}h {m}m {s}s` (e.g. `0h 2m 15s`), computed as the difference between "now" (dialog-open time) and `gamePlay.startTime`.
- **Failure case** — when the `Dialog` opens with `gameIsSolvable` `false`, it shows a failure-severity alert only, with no elapsed-time string.
- No forced-undo mechanic is implemented anywhere in this phase — the sad-face icon and the failure alert are informational only; the player remains free to continue placing or undoing moves as normal via existing controls (Undo stays driven solely by Phase 10's `placedCells`-empty guard, untouched by this phase).
- A duration timer exists that measures elapsed time from `gamePlay.startTime` to "now," used to compute the Dialog's elapsed-time string at the moment the tray empties; the timer's own ticking/local state lives in `useAppState.ts` (or an equivalent state-tier file if `App`'s hooks were already split by an earlier phase), not as ad hoc `useState` directly inside `App.tsx`.
- `App`'s hook(s) are split into `useAppDomain.ts` / `useAppState.ts` / `useAppActions.ts` / `useAppViewModel.ts` per `docs/CONVENTIONS.md`'s non-trivial scale rule, with the elapsed-time formatting and finished/success/failure derivation living in `useAppDomain.ts` as pure functions (no React, no telescope imports) — a flat, unsplit `useAppViewModel.ts` surviving past this phase (given the business-rule complexity this phase adds) is a boundary violation a reviewer should flag.
- `App` still follows the `state,telescope → useAppViewModel → RenderApp` fractal pattern (`docs/fractal_component.md`, `requirements.md` §7.2) after the split, and any parent→child state flow to `SolvabilityIcon` (or the Dialog) uses a magnified telescope (`telescope.magnify(new Lens(get, set))`) — not prop-drilled callbacks.
- `SolvabilityIcon.types.ts` holds only its props type and view-model type — no hook logic — per `docs/CONVENTIONS.md`'s file-layout convention.
- Any new state added to `AppState` (e.g. Dialog open/closed, timer-related fields) is `readonly`/`ReadonlyArray`/`ReadonlyMap`-typed consistently with the rest of `AppState`, and updates are expressed as new objects via spread, never in-place mutation.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with no errors.

## Manual test checklist
- Run `pnpm dev` and open the app in a browser, with `hintGameIsSolvable: true` (the default preference, per `requirements.md` §4.2).
- Play a game to completion while keeping every move valid and the board solvable throughout (leave `preventInvalidMoves` at its default `true` and avoid any workaround that would allow an invalid move); confirm the top-bar solvability icon shows the happy-face state throughout play.
- Continue placing pieces until the tray empties completely; confirm a Dialog appears immediately showing a success alert with an elapsed-time string formatted `{h}h {m}m {s}s` that plausibly matches how long the game actually took.
- Start a new game, then temporarily allow an invalid move via the same manual-testing-only workaround used in Phase 11 (edit the `preventInvalidMoves` default to `false`, or write `preventInvalidMoves: false` directly into the persisted preferences object in `localStorage` before reloading — revert this afterward) and deliberately place at least one piece that violates the neighbor rule or row/column/section uniqueness, driving the game into an unsolvable state.
- Confirm the top-bar solvability icon switches to the sad-face state once the board becomes unsolvable.
- Continue placing the remaining tray pieces (order doesn't matter once already unsolvable) until the tray empties; confirm the Dialog appears showing a failure alert only, with no elapsed-time string.
- With the game still in an unsolvable-but-not-yet-finished state, toggle `hintGameIsSolvable` off (via the same temporary-preference workaround, since the real Preferences panel toggle doesn't ship until Phase 16) and confirm the solvability icon disappears entirely from the top bar; toggle it back on and confirm the correct happy/sad-face state reappears.
- Confirm the browser devtools console shows no errors throughout, including no errors from the duration timer continuing to run across a completed game.
- Revert whichever `preventInvalidMoves`/`hintGameIsSolvable` workaround was used once the manual test is complete.

## Depends on
- Phase 14 merged.
