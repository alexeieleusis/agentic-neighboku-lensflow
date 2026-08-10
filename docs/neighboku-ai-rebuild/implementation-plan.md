# Neighboku AI Rebuild — Implementation Plan

Companion to [`requirements.md`](requirements.md); read that first. This document
covers the two-track experiment design, the per-phase workflow that wraps every
feature, the safeguards that keep an unattended AI harness on track, and the ordered
phase list itself.

## 1. Experiment design

### 1.1 Two tracks, two repos

| Repo | Purpose |
|---|---|
| `neighboku-ai-baseline` | dotharness + vibe-heal + SonarQube, no LensFlow. |
| `neighboku-ai-lensflow` | Identical setup, plus the LensFlow ESLint plugin feeding its findings into the same SonarQube project. |

Both are new, empty GitHub repos (not branches of the existing `neighboku` repo) —
this keeps SonarQube projects, PR numbering, and history completely independent per
track, and keeps the hand-written original's history out of the comparison entirely.

### 1.2 Controlling the variable

Both tracks consume **the same** `requirements.md` and **the same** per-phase task
description files (§4), copied verbatim per track (§4.7) — the only intended difference
between the two runs is whether LensFlow's rules are active in the ESLint config that
feeds SonarQube. Everything else (backend model/CLI, review prompts, retry budgets,
definition of done) must be held constant across tracks, or the comparison is
meaningless.

### 1.3 Lockstep execution

Run the tracks phase-by-phase in lockstep: finish phase *N* on both tracks (through
merge) before starting phase *N+1* on either. This keeps the per-phase Sonar deltas
comparable (same requirements text was "fresh" context on both sides) and stops one
track from silently drifting ahead if the other gets stuck on a hard phase.

### 1.4 Metrics to record per phase, per track

Keep a running log (`docs/experiment-log.md` in each repo, or a shared sheet) with, at
minimum: Sonar issues opened / resolved / left open at merge, issues specifically
attributable to LensFlow rules (LensFlow track only), number of `address-comments`
cycles needed, wall-clock time from PR-open to merge, PR diff size (files/lines), number
of human interventions/escalations, and whether the manual test checklist passed on the
first try. This is what turns "we tried it twice" into an actual comparison at the end
(§6).

## 2. The per-phase workflow

Every feature phase (not Phase 0, see §3) goes through the same eight steps, on each
track independently:

1. **Implement.** A dedicated script feeds the phase's task-description file
   (`docs/phases/NN-name.md`) to opencode, scoped to a fresh branch off the track's
   `main`. Invoke it the same way dotharness invokes its own backend, for consistency:
   `opencode run --pure --dangerously-skip-permissions --dir <repo> <instructions>`.
   The script commits the result with a descriptive message.
2. **Push + open PR.** The script pushes the branch and runs `gh pr create`, using the
   phase file's acceptance criteria as the PR body so the PR is self-describing for the
   review step.
3. **Static analysis.** Run `vibe-heal review --post` (or `cleanup` if a fuller pass is
   wanted) against the PR's changed lines; this posts inline SonarQube-derived comments.
   On the LensFlow track, the repo's ESLint config includes the LensFlow plugin, so its
   findings are part of the same analysis run and land in the same SonarQube project —
   no separate step.
4. **Code review.** Run `harness run review-requested` (if review was requested from
   the harness's `gh` account) or `harness run self-review`, with
   `[focused_review] enabled = true` in `.harness.toml` so any Sonar comment citing a
   `vibe-types` knowledge file gets elaborated into a full refactor description instead
   of a bare rule ID. Add a standing review instruction (see §4.3) that
   fractal-component-pattern violations are blocking findings, not style nits.
5. **Address comments.** Run `harness run address-comments`. It reads unresolved
   threads and pushes the smallest fix per thread.
6. **Iterate 3–5** until no actionable findings remain, or the phase's retry budget is
   exhausted (§4.2) — in which case, stop and escalate to a human rather than looping.
7. **Manual test.** Run `npm run dev` and walk the phase's manual-test checklist (drawn
   from the relevant `requirements.md` section — each phase below names it). Log
   pass/fail in the experiment log.
8. **Merge.** Only after 3–7 are clean. `gh pr merge`, then move to the next phase.

## 3. Phase 0 — Bootstrap (both tracks)

Not run through the review loop above — this is scaffolding, largely human- or
script-driven, done once per repo before Phase 1 starts.

- Create the two GitHub repos (confirm with the user before creating — this plan
  doesn't do it automatically).
- Scaffold with `yarn create vite` (React + TS template) and install the stack pinned
  in `requirements.md` §7.1, the lint plugins from §7.4, plus `@fontsource/roboto`
  (matching the original's first commits; not itself pinned in §7.1).
- Add `sonar-project.properties`; stand up (or reuse) a SonarQube project per repo.
- Write `.harness.toml` per repo (uncommitted, per dotharness convention — add it to
  the global gitignore, not the repo's). `[vibe_heal] enabled = true` and
  `[focused_review] enabled = true` on **both** tracks. LensFlow is wired into the
  ESLint config (and therefore into what SonarQube sees) **only** on
  `neighboku-ai-lensflow`.
- Build/adapt the "dedicated implement-feature" script described in step 1 of §2.
- Copy `requirements.md`, `fractal_component.md`, and this plan's phase files into each
  new repo's `docs/`, so the harness has them as durable, versioned context rather than
  relying on prompt-only instructions.
- Definition of done for Phase 0: both repos build, lint, and test clean with the empty
  scaffold; `.harness.toml` passes `harness validate` on both.

## 4. Safeguards

These apply to every feature phase and exist specifically because the harness runs
with `--dangerously-skip-permissions` and is expected to iterate with minimal
supervision — the safeguards are what make that safe to leave running.

### 4.1 Scope boundary

Each phase task-description file (§5 format) names the exact files/components it may
create or touch. A diff that touches files outside that list is a review-blocking
finding, not something to wave through — this is the primary defense against scope
creep and against one phase silently "fixing" work that belongs to a later phase.

### 4.2 Bounded retries

Cap `address-comments` cycles per PR (suggest 3). If findings are still open after that,
stop the loop and escalate to a human instead of iterating indefinitely against Sonar
noise or a review comment the AI keeps misunderstanding.

### 4.3 Architecture conformance is a blocking category

Per `requirements.md` §7.2 and §7.2.1, both the outer fractal pattern
(`state,telescope → useXViewModel → RenderX`, magnified telescopes for parent→child
flow) and its internal split-hook refinement (`useXDomain`/`useXState`/`useXActions` for
non-trivial components) are blocking finding categories at the same severity tier as a
correctness bug — this is the single highest-leverage guardrail for keeping ~20
independently-generated PRs structurally consistent with each other. See
`requirements.md` §7.2.1 for the specific split-hook violation criteria. Give the review
step access to `~/.harness/knowledge/patterns/react/` (start with
`QUICK_REF_PATTERNS.md`, per requirements.md's own reading order) so review comments can
cite the specific convention rather than a vague restructuring request. Not every
component needs the split (§7.2.1) — flag missing splits only on components with real
state/action complexity, not on simple leaves.

### 4.4 Hard merge gates

No merge with a failing `npm run build`, `npm run lint`, or `npm test` — enforced even
though the original repo had no CI, because this rebuild is unattended in a way the
original hand-written process wasn't.

### 4.5 Definition of done ≠ "it compiles"

Each phase's done-criteria is the relevant `requirements.md` acceptance criteria,
verified by the manual test checklist (§2 step 7) — not merely a green build. A phase
that compiles but doesn't match the specified behavior (e.g. wrong tie-breaking rule in
board generation, missing the click-to-place fallback) is not done.

### 4.6 Dependency ordering

Phases are listed in dependency order below. Don't start phase *N+1* work on a track
before phase *N* is merged on that same track — later phases assume earlier
domain/UI pieces exist and are stable.

**Documented for reference, not acted on:** several adjacent phases are only weakly
coupled — their real prerequisite is an earlier phase, not the immediately preceding
one. Phase 10 (Undo) and Phase 11 (Invalid-move feedback) both only need Phase 3 (move
engine) and Phase 4 (app shell), not each other. Phase 12 (`CellDisplay` hints) and
Phase 13 (`AvailablePiecesTray` hints) both only need Phase 3 (fit caches) and Phase 7
(tray), not each other. This plan still executes every phase strictly in table order —
one branch per track at a time (§1.3, §2) — because that keeps the review loop simple
and keeps §1.4's per-phase Sonar-delta metric comparable across phases; the note above
is purely informational, for anyone later deciding whether the harness itself should run
independent phases concurrently.

### 4.7 Comparison hygiene

Keep phase task files byte-identical across tracks (copy, don't re-type or re-derive
per repo) and keep the experiment log (§1.4) current every phase, not retroactively —
this is what makes §6's comparison trustworthy.

## 5. Phase task-description format

Each phase gets one file, `docs/phases/NN-name.md`, copied verbatim into both repos:

```markdown
# Phase NN — <name>

## Scope (files this phase may create/modify)
- <explicit file list or glob>

## Requirements
<link to the relevant requirements.md section(s), plus the literal excerpt so the
harness doesn't have to re-derive it from a separate file>

## Acceptance criteria
- <bullet list, testable>

## Manual test checklist
- <steps to run against `npm run dev`>

## Depends on
- Phase <N-1> merged.
```

## 6. Feature phases (dependency order)

| # | Phase | Scope (primary files) | Depends on | Requirements ref | Manual test focus |
|---|---|---|---|---|---|
| 1 | Domain core: attributes & neighbor rule | `game/entities.ts`, `game/common.ts` + unit tests | 0 | §3.1, §3.2 | N/A (unit-test only) |
| 2 | Board generator | `game/boardBuilder.ts` + unit tests | 1 | §3.1, §3.3 | N/A (unit-test only) |
| 3 | Puzzle unfolding & move engine | `game/gameBuilder.ts` (`unfoldGame`, `placePiece`, `undoPlay`, fit caches) + unit tests | 2 | §3.4, §3.5, §3.6 | N/A (unit-test only) |
| 4 | Fractal component base + app shell skeleton | `base/TelescopeComponent.ts`, `base/DndKitInterfaces.ts`, `App.tsx`/`App.types.ts`, `main.tsx` (renders an empty shell over a real generated board) | 3 | §7.2, §7.3, §5.1 | Load app, confirm a board renders (unstyled ok) with no console errors |
| 5 | Board rendering | `BoardDisplay`, `RowDisplay`, `CellDisplay` (+ `.types.ts` + hooks) | 4 | §5.2 | Grid renders full board, sections visually distinguishable |
| 6 | Piece rendering — Shapes | `PieceDisplay` (+ `.types.ts` + hooks), shape/color tables | 5 | §5.3 (screenshot-test candidate, §7.5) | Every `base=3,dim=3` piece renders a distinct shape/color combo |
| 7 | Available pieces tray | `AvailablePiecesTray` (+ `.types.ts` + hooks) | 6 | §5.5 (counts + sort only, defer hint/asterisk/click-to-place) | Tray lists all remaining pieces with correct counts |
| 8 | Drag and drop — desktop | `DraggablePiece` (+ `.types.ts` + hooks), `DndContext` wiring, `handleDragEnd` → `placePiece` | 7 | §5.6 (desktop only; interaction-test candidate, §7.5) | Drag a piece from tray onto a legal cell; illegal drop is rejected or flagged per `preventInvalidMoves` |
| 9 | Drag and drop — mobile | Same components, touch sensor config | 8 | §5.6 (mobile), §7.6 (interaction-test candidate, §7.5) | Same flow on a touch device/emulated touch |
| 10 | Undo | `UndoButton` (+ `.types.ts` + hook) | 9 | §3.5, §5.7 | Place a piece, undo, confirm board/tray revert and button disables at zero moves |
| 11 | Invalid-move feedback | `App.tsx` Snackbar wiring | 10 | §5.12 | Trigger an invalid move with `preventInvalidMoves: false`, confirm Snackbar + auto-hide (see note below the table — the Preferences panel toggle for this doesn't exist until Phase 16) |
| 12 | Hints: fit count & hover preview | `CellDisplay` extensions for `hintFitPieceCount`/`showFitPiecesOnHover` | 11 | §5.2, §5.11 (interaction-test candidate for the hover tooltip, §7.5) | Toggle each hint off/on, confirm cell counts and hover tooltip match |
| 13 | Hints: unique-cell asterisk & click-to-place | `AvailablePiecesTray` extensions for `hintAvailablePieceUniqueCell`/`hintPieceCells` | 12 | §5.5, §5.11 | Force a unique-placement state, confirm `*`; confirm click-to-place buttons place correctly |
| 14 | Drag-fit hint icon | `DraggablePiece.types.ts` `DragHint` state machine, top-bar icon | 13 | §5.6, §5.11 (interaction-test candidate, §7.5) | Drag over valid/invalid/no target, confirm icon states match `DragHint` enum |
| 15 | Solvability indicator & game-finished dialog | `App.tsx` `gameIsSolvable`, finished Dialog, duration timer | 14 | §3.6, §5.13 | Play to an empty tray both in a solvable and an unsolvable state, confirm correct dialog + duration |
| 16 | Preferences panel & persistence | `PreferencesDisplay` (+ `.types.ts` + hooks), `localStorage` wiring in `main.tsx` | 15 | §4.2, §4.3, §5.8 | Toggle every preference, reload, confirm persistence (including the forced-`dimension:3` quirk, §8.5 of requirements); also confirm Phase 11's Snackbar path still works now that `preventInvalidMoves` has a real UI toggle |
| 17 | New Game panel & board size selection | `NewGamePanel` (+ shared `.types.ts` + hooks) | 16 | §4.1, §5.9 | Start a new game at every board size option, confirm dimension rule (§4.1) |
| 18 | Help panel | `HelpPanel` (+ `.types.ts` + hooks) | 17 | §5.10, §8.1 (diagonal-claim decision) | Open Help, select several pieces, confirm valid/invalid neighbor sets match §3.2; confirm both tutorial links and license link |
| 19 | Faces mode | `PieceDisplay` Faces branch, `public/faces/*.png` assets, license attribution content | 18 | §5.4 (screenshot-test candidate, §7.5) | Toggle Piece Type to Faces, confirm all 27 combinations render; confirm attribution link visible from Help panel |
| 20 | Release polish | Favicon, `neighboku.md`-equivalent in-app/readme description (final cleanup sweep: see §7) | 19 | §5.1 (favicon), §9 | Full playthrough at two board sizes in both piece-type modes |

Phases 1–3 have no UI and are verified by their unit tests plus `npm run build`/`npm run
lint`; "manual test" there just means confirming the test suite is meaningful, not
clicking through a UI that doesn't exist yet.

"(+ `.types.ts` + hooks)" in the Scope column is shorthand for the file layout defined in
requirements.md §7.4/§7.2.1: a `.types.ts` file plus one `useComponentNameViewModel.ts`
hook (or, for non-trivial components, the domain/state/actions split) — not the
superseded single `.entities.ts` file.

**Phase 6 and Phase 19 screenshot tests, Phases 8–9/12/14 interaction tests**: these are
the "genuine cases" §7.5 names for the additive, non-mandatory testing pyramid. They are
not required to satisfy this plan's strict-replication floor; add them only if that tier
is adopted for the given track, per §7.5's own framing.

**Phase 11's manual test needs `preventInvalidMoves: false`, but the Preferences panel
that toggles it doesn't ship until Phase 16 (§5.8) — five phases later.** Until then,
flip it by temporarily editing the default in `preferences.ts` (§4.2) for the duration of
the manual test, or by writing the value directly into the persisted `localStorage` blob
(§4.3) before loading the app; revert the change afterward. This is a manual-testing
workaround only, not a Phase 11 deliverable — Phase 16's own manual test (above) already
re-confirms the same Snackbar path once the real toggle exists.

## 7. Post-track wrap-up

- Run one final `vibe-heal cleanup` sweep across the whole repo per track before
  declaring it "done," independent of any per-phase analysis.
- Confirm `requirements.md` §9 (out of scope) wasn't silently expanded by either track.
- CI: adding a GitHub Actions workflow (build/lint/test on PR) is optional parity — the
  original had none — but recommended given these repos are otherwise unattended;
  decide once per track, not per phase, and treat it as its own small phase if pursued.

## 8. Comparison protocol (after both tracks reach Phase 20)

Using the per-phase log from §1.4, compare the two tracks on:

- Total Sonar issues raised over the whole run, broken down by severity, and how many
  were LensFlow-specific (baseline track will show zero of these by construction — the
  comparison is whether LensFlow's additions caught things the built-in ruleset/Sonar
  otherwise missed, and whether they were worth the extra review noise).
- `address-comments` cycles needed per phase (proxy for how much rework each finding
  category caused).
- Wall-clock time from PR-open to merge per phase.
- Number of human escalations (§4.2) per phase.
- Spot-check both final codebases against `requirements.md` §7.2 (fractal pattern
  conformance) and §7.5 (test coverage) — did either track's static-analysis loop drive
  measurably better adherence to the architecture, or better test coverage, than the
  other?

Write the result to `docs/experiment-results.md` in whichever location is most
convenient (a third, comparison-only repo/doc is fine) once both tracks are complete.
