# Phase 18 — Help panel

## Scope (files this phase may create/modify)
- src/components/HelpPanel/HelpPanel.tsx
- src/components/HelpPanel/HelpPanel.types.ts
- src/components/HelpPanel/useHelpPanelDomain.ts
- src/components/HelpPanel/useHelpPanelState.ts
- src/components/HelpPanel/useHelpPanelActions.ts
- src/components/HelpPanel/useHelpPanelViewModel.ts
- src/components/HelpPanel/HelpPanel.stories.tsx
- src/components/HelpPanel/__tests__/*
- src/App.tsx
- src/App.types.ts
- src/useAppDomain.ts
- src/useAppState.ts
- src/useAppActions.ts
- src/useAppViewModel.ts

## Requirements

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.10 (Help panel), quoted verbatim in full:

> ### 5.10 Help panel
>
> Top drawer, opened via the help icon. Contains, in order:
>
> 1. A piece selector (`Select`, all pieces of the current `base`/`dimension`, rendered
>    via the shared piece display).
> 2. The set of pieces that **are** valid neighbors of the selected piece (computed via
>    `buildPossibleNeighbors` with no exclusions), under a "valid neighbors" grouping icon.
> 3. The set of pieces that are **not** valid neighbors of the selected piece (full
>    candidate space minus the valid set), under an "invalid neighbors" grouping icon.
> 4. A link to the English tutorial video.
> 5. A link to the Spanish tutorial video ("Tutorial en Español").
> 6. The Freepik face-image attribution link (§5.4) — shown regardless of current
>    `pieceType`, since it's a static credit, not conditional on Faces mode being active.
>
> This is the feature described in the video as "select any piece… the app will visually
> show which other pieces can be its neighbors."

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §8.1 (Diagonal neighbors claim (doc/video) vs. orthogonal-only (code)), quoted verbatim in full:

> ### 8.1 Diagonal neighbors claim (doc/video) vs. orthogonal-only (code)
>
> `src/neighboku.md` and the tutorial video both state the neighbor rule "applies to all
> neighboring cells (horizontal, vertical, and diagonal)". The actual implementation
> (`findGameNeighbors`, `findNeighbors`) only ever considers up/down/left/right. **Decision
> for the rebuild: replicate the code's orthogonal-only behavior** (it's the actual,
> tested, shipped game rule); the descriptive text can be carried forward as-is (it's
> pre-existing content, not a functional requirement) or corrected — flag this choice
> explicitly to the human reviewer at Phase 18 (Help panel / in-app docs).

**Boundary this phase must implement (not part of the literal excerpts above):**
`buildPossibleNeighbors` itself is Phase 2 scope (`src/game/boardBuilder.ts`, per
`docs/phases/02-board-generator.md`) and is already fully implemented and unit-tested
there. This phase does not reimplement or duplicate that computation — it only **calls**
`buildPossibleNeighbors` with no exclusions for the currently-selected piece to derive the
valid-neighbors set, and derives the invalid-neighbors set as the full candidate space
(all pieces of the current `base`/`dimension`) minus that valid set. The shared piece
display referenced by §5.10 item 1 and by the two neighbor-set groupings is `PieceDisplay`
(Phase 6, `src/components/PieceDisplay/`); this phase renders pieces through that existing
component and does not build a second piece-rendering path. `PieceDisplay`'s Faces-mode
branch does not exist until Phase 19, so at this phase `PieceDisplay` only ever renders
Shapes — the Help panel must not assume or special-case Faces-mode rendering, and the
Freepik attribution link (item 6) must render unconditionally regardless of `pieceType`
even though no Faces UI exists yet to toggle to. The literal target URLs for the English
and Spanish tutorial video links are not pinned anywhere in `requirements.md` as copyable
strings (only their existence, order, and labels are specified above); this phase must
still wire each to a real, non-empty, non-placeholder `href` (sourced from the original
project's in-app documentation/README, consistent with how the Freepik URL in §5.4 was
carried forward) rather than leaving a dead `#` link or literal placeholder text.

`App`'s hook(s) are extended by this phase to wire the existing top-bar Help button
(placeholder since Phase 4, per `docs/phases/04-app-shell.md`) to open/close the
`HelpPanel` drawer, the same pattern Phase 15 used to wire the solvability dialog and
Phases 16–17 used for the Preferences and New Game drawers: drawer open/closed state and
the currently-selected-piece-in-the-drawer state belong in `useAppState.ts` (or
`HelpPanel`'s own `useHelpPanelState.ts` for state local to the drawer's contents — see
below), the open/close handler lives in `useAppActions.ts`, and `useAppViewModel.ts`
remains the wiring-only orchestrator. `App`'s parent-to-child flow into `HelpPanel` uses a
magnified telescope (`telescope.magnify(new Lens(get, set))`), not prop-drilled callbacks,
per §7.2.

Per `docs/CONVENTIONS.md`'s scale rule, `HelpPanel` is a non-trivial component — it has
real local state (the selected piece in the piece selector) and a real business-rule
computation (deriving the valid/invalid neighbor sets) — so it is split into
`useHelpPanelDomain.ts` (pure functions: no React, no telescope imports — computing the
full candidate-piece list for the current `base`/`dimension`, calling
`buildPossibleNeighbors` for the valid-neighbors set, and computing the invalid-neighbors
set as candidate-space-minus-valid-set), `useHelpPanelState.ts` (the selected-piece local
state plus the two neighbor sets derived from it via the domain functions),
`useHelpPanelActions.ts` (the piece-selector's `onChange` handler), and
`useHelpPanelViewModel.ts` (the orchestrator composing the three, wiring only) — matching
`FaceSwatchBoard`'s established split (`src/components/FaceSwatchBoard/`).

**Diagonal-neighbors discrepancy — this phase must explicitly flag it, not silently
resolve it either way.** §8.1 above requires the rebuild to replicate the code's
orthogonal-only behavior (already done in Phases 1–3's domain layer, and reused as-is by
this phase's call to `buildPossibleNeighbors`) while leaving open whether any in-app
descriptive text about the neighbor rule is corrected to say "orthogonal" or carried
forward saying "diagonal" (matching the original doc/video's wording). This phase must
surface that open choice to a human reviewer explicitly — e.g. a code comment directly
above wherever `HelpPanel` renders or references neighbor-rule descriptive text, plus an
explicit call-out in the PR description — rather than the implementation silently picking
one wording without comment. Picking either wording without any flag is a boundary
violation for this phase, independent of which wording is picked.

## Acceptance criteria
- `HelpPanel` renders as a top drawer (MUI `Drawer` with `anchor="top"`), opened via the existing top-bar help icon (placeholder since Phase 4) and closeable, occupying the help-icon slot in the top bar's observed order (§5.1).
- `HelpPanel`'s contents render in the exact order specified by §5.10: (1) the piece selector, (2) the valid-neighbors set under a "valid neighbors" grouping icon, (3) the invalid-neighbors set under an "invalid neighbors" grouping icon, (4) the English tutorial video link, (5) the Spanish tutorial video link labeled "Tutorial en Español", (6) the Freepik attribution link.
- The piece selector is a `Select` listing every piece of the current `base`/`dimension` (the full candidate space, `base^dimension` pieces), with each option rendered via the shared `PieceDisplay` component (Phase 6) rather than a bespoke rendering path.
- Selecting a piece in the selector updates the valid-neighbors and invalid-neighbors displays to reflect that piece, with no piece selected by default triggering a sensible empty/placeholder state (not a crash or an unhandled `undefined`).
- The valid-neighbors set is computed by calling `buildPossibleNeighbors` (from `src/game/boardBuilder.ts`, Phase 2) with no exclusions for the selected piece — this phase reuses that existing, already-unit-tested domain function and does not reimplement or duplicate its logic inside `useHelpPanelDomain.ts` or anywhere else in `HelpPanel`.
- The invalid-neighbors set is computed as the full candidate-piece space (every piece of the current `base`/`dimension`) minus the valid-neighbors set, as a pure function in `useHelpPanelDomain.ts`, and every piece in the candidate space appears in exactly one of the two sets (no overlap, no omissions) for any selected piece.
- Both the valid-neighbors and invalid-neighbors sets render their member pieces via the shared `PieceDisplay` component, each set grouped under its own distinct icon ("valid neighbors" vs. "invalid neighbors") so the two groupings are visually distinguishable.
- The English tutorial video link and the Spanish tutorial video link ("Tutorial en Español") are both present, separately labeled, and each has a real, non-empty, non-placeholder `href` pointing to an actual video URL — not a dead `#` link or literal placeholder text.
- The Freepik face-image attribution link (§5.4: `https://www.freepik.com/free-vector/young-people-expressions-with-different-faces_1250793.htm`, labeled "Images under license by Freep!k") is present and renders unconditionally regardless of the current `pieceType` preference value — it is not gated behind `pieceType === "Faces"` or any conditional.
- The diagonal-neighbors discrepancy (§8.1) is explicitly surfaced for human review — via a code comment directly above any neighbor-rule descriptive text in `HelpPanel` and/or an explicit call-out in the PR description — rather than the implementation silently choosing "orthogonal" or "diagonal" wording with no flag; a reviewer must be able to find this call-out without independently rediscovering the discrepancy.
- `HelpPanel`'s file layout follows `docs/CONVENTIONS.md`'s non-trivial-component split: `HelpPanel.tsx` (component + `RenderHelpPanel`), `HelpPanel.types.ts` (props/view-model types only, no hook logic), `useHelpPanelDomain.ts` (pure functions, no React/telescope imports), `useHelpPanelState.ts` (local selected-piece state plus telescope-derived values via the domain functions), `useHelpPanelActions.ts` (the piece-selector change handler, committing via `telescope.update`/`.evolve`), and `useHelpPanelViewModel.ts` (the wiring-only orchestrator).
- `HelpPanel` follows the outer `state,telescope → useHelpPanelViewModel → RenderHelpPanel` fractal pattern (`docs/neighboku-ai-rebuild/requirements.md` §7.2), and any parent-to-child state flow (e.g. `App` → `HelpPanel`) uses a magnified telescope (`telescope.magnify(new Lens(get, set))`), not prop-drilled callbacks.
- Any new state introduced in `App` or `HelpPanel` (drawer open/closed, selected piece, derived neighbor sets) is `readonly`/`ReadonlyArray`/`ReadonlyMap`-typed at every level, with updates expressed as new objects via spread, never in-place mutation, including for `Map`s (`requirements.md` §7.3).
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with no errors.

## Manual test checklist
- Run `pnpm dev`, open the app in a browser, and open the Help drawer via the top-bar help icon.
- Select several different pieces one at a time from the piece selector; for each, confirm the "valid neighbors" set exactly matches the pieces that share exactly one attribute position with the selected piece, per §3.2's exact neighbor rule (Phase 1).
- For each selected piece, confirm the "invalid neighbors" set is exactly the complement of the valid set within the full candidate space (every candidate piece appears in one set or the other, never both, never neither).
- Confirm both the English and Spanish ("Tutorial en Español") tutorial video links are visibly present, separately labeled, and each opens/points to a real, non-placeholder video URL.
- Confirm the Freepik attribution link is visible in the Help drawer regardless of the current `pieceType` preference — test with Shapes mode active (the only mode that actually renders content this early, since Faces mode UI isn't built until Phase 19) and confirm the link still appears even though there is no Faces-mode UI yet to switch to.
- Confirm the drawer opens as a top drawer (not bottom, matching Preferences/New Game) and closes cleanly without leaving stray overlay/backdrop artifacts.
- Confirm the diagonal-neighbors discrepancy flag (a code comment and/or PR call-out per this phase's acceptance criteria) is present and locatable in the diff.
- Confirm the browser devtools console shows no errors or warnings throughout.

## Depends on
- Phase 17 merged.
