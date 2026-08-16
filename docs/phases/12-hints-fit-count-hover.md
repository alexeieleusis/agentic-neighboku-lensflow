# Phase 12 — Hints: fit count & hover preview

## Scope (files this phase may create/modify)
- src/components/CellDisplay/CellDisplay.tsx
- src/components/CellDisplay/CellDisplay.types.ts
- src/components/CellDisplay/useCellDisplayDomain.ts
- src/components/CellDisplay/useCellDisplayState.ts
- src/components/CellDisplay/useCellDisplayActions.ts
- src/components/CellDisplay/useCellDisplayViewModel.ts
- src/components/CellDisplay/CellDisplay.stories.tsx
- src/components/CellDisplay/__tests__/useCellDisplayDomain.test.ts

## Requirements

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.2 (Board rendering), the
blank-cell hint sentence, quoted verbatim:

> - A blank cell shows its `pieceType`-appropriate droppable target; if
>   `hintFitPieceCount` is on, it shows the count of pieces that would legally fit there;
>   if `showFitPiecesOnHover` is on, hovering/tapping a blank cell reveals a tooltip
>   listing every piece that would fit.

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.11 (Hints summary
cross-reference), the two rows relevant to this phase, quoted verbatim:

> | Hint | Preference | Behavior |
> |---|---|---|
> | Fit count per cell | `hintFitPieceCount` | §5.2 |
> | Fit pieces on hover | `showFitPiecesOnHover` | §5.2 |

**Phase boundary note (not part of the literal excerpts above):** Phase 5 built
`CellDisplay` as a trivial component and explicitly deferred `hintFitPieceCount` and
`showFitPiecesOnHover` to this phase — see `docs/phases/05-board-rendering.md`. Both
hints must derive from the `cellToFitPieces` fit cache established in Phase 3
(`game/gameBuilder.ts`), not from ad-hoc recomputation of fit legality inside this
component. `requirements.md` §7.5 additionally flags the hover-triggered fit-piece
tooltip as an interaction-test candidate if that testing tier is later adopted — this is
optional/additive and not required for this phase's floor (see Acceptance criteria).

## Acceptance criteria
- Blank cells display a fit-piece count when `hintFitPieceCount` is `true` and show no
  count when it is `false`; the count is never shown on filled cells regardless of the
  preference.
- Hovering (desktop pointer) or tapping (touch) a blank cell reveals a tooltip listing
  every piece that would legally fit that cell when `showFitPiecesOnHover` is `true`;
  the tooltip never appears (on hover/tap or otherwise) when the preference is `false`,
  and never appears on filled cells regardless of the preference.
- Both the fit count and the tooltip's piece list are derived from the `cellToFitPieces`
  cache built and kept in sync in Phase 3 (`game/gameBuilder.ts`) — this phase does not
  reimplement or duplicate fit-legality computation inside `CellDisplay`.
- `CellDisplay`'s file layout is re-evaluated against `docs/CONVENTIONS.md`'s scale rule
  now that it has real local hover/tap state and business logic for deriving the
  displayed count/tooltip contents: it is split into `useCellDisplayDomain.ts` (pure
  functions deriving the count and fit-piece list from `cellToFitPieces`, no React/
  telescope imports), `useCellDisplayState.ts` (local hover/tap state plus
  telescope-derived values via the domain functions), `useCellDisplayActions.ts`
  (hover-enter/leave and tap event-handler closures, no business logic in the handler
  bodies), and `useCellDisplayViewModel.ts` (the wiring-only orchestrator composing the
  three). Phase 5's flat `useCellDisplayViewModel.ts`-only layout is superseded by this
  split; a reviewer should treat retaining the flat, unsplit form as a boundary
  violation for this phase, not an acceptable minimal diff.
- `CellDisplay` still follows the `state,telescope → useXViewModel → RenderX` fractal
  pattern (`docs/fractal_component.md`, `requirements.md` §7.2) after the split, with
  parent→child state flow (if any) via a magnified telescope
  (`telescope.magnify(new Lens(get, set))`) — not prop-drilled callbacks.
- `CellDisplay.types.ts` holds only the props type and view-model type (including any
  new fields needed for the count/tooltip) — no hook logic.
- A domain-function test (`useCellDisplayDomain.test.ts`) covers deriving the fit-piece
  count and the fit-piece list from a `cellToFitPieces`-shaped input, independent of
  React rendering, per the domain-function-first testing priority in `requirements.md`
  §7.5 and `docs/CONVENTIONS.md`'s testing pyramid section.
- The hover-triggered tooltip interaction is optionally, not mandatorily, covered by a
  real-browser interaction test in this phase — `requirements.md` §7.5 documents it as
  an interaction-test candidate for later adoption; its absence here is not a phase
  boundary violation.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with this phase's changes.

## Manual test checklist
- Run `pnpm dev` and open the app.
- With `hintFitPieceCount: true` (the default preference, per `requirements.md` §4.2),
  confirm every blank cell shows a count of legally-fitting pieces.
- Temporarily edit the stored/default `hintFitPieceCount` preference to `false` (no
  Preferences panel toggle exists yet — Phase 16 ships the real toggle UI) and confirm
  blank cells no longer show a fit-piece count; toggle back to `true` and confirm the
  count reappears.
- With `showFitPiecesOnHover: true` (the default), hover a blank cell on desktop (or tap
  it on a touch/mobile viewport) and confirm a tooltip appears listing every piece that
  would legally fit that cell.
- Temporarily edit `showFitPiecesOnHover` to `false` and confirm hovering/tapping a
  blank cell no longer shows any tooltip; toggle back to `true` and confirm it reappears.
- Confirm neither the fit-piece count nor the hover/tap tooltip ever appears on a filled
  cell, regardless of either preference's value.
- Confirm no errors appear in the browser console throughout.

## Depends on
- Phase 11 merged.
