# Phase 19 — Faces mode

## Scope (files this phase may create/modify)
- src/components/PieceDisplay/PieceDisplay.tsx
- src/components/PieceDisplay/PieceDisplay.types.ts
- src/components/PieceDisplay/usePieceDisplayViewModel.ts
- src/components/PieceDisplay/pieceFaceTables.ts
- src/components/PieceDisplay/__tests__/*
- src/components/HelpPanel/HelpPanel.tsx
- src/components/HelpPanel/HelpPanel.types.ts
- src/components/HelpPanel/useHelpPanelDomain.ts
- src/components/HelpPanel/useHelpPanelState.ts
- src/components/HelpPanel/useHelpPanelActions.ts
- src/components/HelpPanel/useHelpPanelViewModel.ts
- src/components/HelpPanel/__tests__/*
- public/faces/*.png

## Requirements

From `docs/neighboku-ai-rebuild/requirements.md` §5.4 (Piece rendering — Faces mode), in full:

> - Piece is rendered as an image `/faces/h{h}e{e}m{m}.png` where `h/e/m` are
>   `piece[0]/piece[1]/piece[2]` — hair color, eye expression, mouth expression, matching
>   the video's description.
> - Requires the 27 (`3×3×3`) face PNGs under `public/faces/`, sourced under a Freepik
>   license. The Help panel (§5.11) must attribute them: a link to
>   `https://www.freepik.com/free-vector/young-people-expressions-with-different-faces_1250793.htm`
>   labeled "Images under license by Freep!k". Re-verify the exact face asset license
>   terms before shipping the rebuild publicly — don't assume the original attribution
>   text is complete/current without checking.
> - `PieceType` (Shapes/Faces) is a user preference (§4.2), toggled in the Preferences
>   panel, applied uniformly across board, tray, and Help panel piece displays.

Related excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.10 (Help panel), item 6 of
its ordered contents:

> 6. The Freepik face-image attribution link (§5.4) — shown regardless of current
>    `pieceType`, since it's a static credit, not conditional on Faces mode being active.

Related excerpt, `docs/neighboku-ai-rebuild/requirements.md` §4.2 (Default preferences on
first load): `pieceType: Shapes` is the default — Faces mode is opt-in via the Preferences
panel (Phase 8's `pieceType` switch), not the initial state.

Related non-mandatory note, `docs/neighboku-ai-rebuild/requirements.md` §7.5 (Testing
baseline / testing pyramid):

> `PieceDisplay`'s shape/color rendering (§5.3) and the Faces image grid (§5.4) are
> screenshot-test candidates.

This is additive, not required for this phase's floor — see the optional testing note
under Acceptance criteria below.

Carried-forward asset note, `docs/CONVENTIONS.md` ("Reference assets already seeded here"
section): the 27 face images (`h{h}e{e}m{m}.png`) already exist under `public/faces/` in
this repo, copied from the original Neighboku source — this phase does **not** need to
source, generate, or otherwise author these images; it only needs to wire up the Faces
rendering branch of `PieceDisplay` and the license attribution content in the Help panel.
That same CONVENTIONS.md section repeats the license re-verification instruction from
requirements.md §5.4/§8: re-verify the exact face-asset license terms before shipping
publicly rather than assuming the carried-forward attribution text is complete or current.

## Acceptance criteria
- `PieceDisplay` renders `/faces/h{h}e{e}m{m}.png` correctly for all 27 (`3×3×3`) `piece[0]`/`piece[1]`/`piece[2]` combinations when the current `pieceType` preference is `Faces`, with `h`/`e`/`m` mapped exactly to `piece[0]`/`piece[1]`/`piece[2]` (hair color / eye expression / mouth expression) per §5.4.
- `pieceFaceTables.ts` (or equivalent domain helper) exports the pure `piece → image path` mapping described above, with no business logic duplicated inline in `PieceDisplay.tsx`.
- The `pieceType` preference (`Shapes`/`Faces`) is applied uniformly by reusing the same shared `PieceDisplay` component everywhere pieces are rendered — `BoardDisplay` (Phase 5), `AvailablePiecesTray` (Phase 7), and `HelpPanel`'s piece selector and valid/invalid neighbor-set displays (Phase 18) — with no separate, duplicated Faces-rendering implementation in any of those consumers.
- Switching `pieceType` to `Faces` in Preferences causes board cells, tray pieces, and the Help panel's piece displays to all switch to face images; switching back to `Shapes` restores shape rendering everywhere, with no stale rendering left over from the previous mode.
- The Help panel shows the Freepik attribution link — exact URL `https://www.freepik.com/free-vector/young-people-expressions-with-different-faces_1250793.htm`, labeled "Images under license by Freep!k" — and the link is present regardless of the current `pieceType` value (i.e. also visible while in Shapes mode).
- Before this phase is considered ready to ship publicly, the exact Freepik license terms for these assets have been re-verified (not merely copied forward from the carried-forward attribution text) and the in-app attribution text/link reflects that verification.
- No new face images are created, regenerated, or modified by this phase — the pre-seeded `public/faces/*.png` (27 files) are used as-is.
- `PieceDisplay`'s Faces branch continues to follow the fractal component pattern `state,telescope → useXViewModel → RenderX` (`docs/neighboku-ai-rebuild/requirements.md` §7.2) established in Phase 6, and `HelpPanel`'s file layout continues to follow its established non-trivial-component split (`HelpPanel.tsx` / `HelpPanel.types.ts` / `useHelpPanelDomain.ts` / `useHelpPanelState.ts` / `useHelpPanelActions.ts` / `useHelpPanelViewModel.ts`) per `docs/CONVENTIONS.md`'s scale rule.
- The app builds, lints, and tests clean (`pnpm build`, `pnpm lint`, `pnpm test`).
- Optional testing note (not required for this phase's floor): `docs/neighboku-ai-rebuild/requirements.md` §7.5 documents the Faces image grid as a screenshot-test candidate if that testing tier is later adopted; no browser-mode/screenshot test is required to satisfy this phase.

## Manual test checklist
- Run `pnpm dev` and open the app in a browser.
- Open Preferences and toggle Piece Type to Faces.
- Confirm board cells and tray pieces now render as face images instead of shapes.
- For several placed/tray pieces, confirm the rendered image's filename matches `h{h}e{e}m{m}.png` for that piece's actual `piece[0]`/`piece[1]`/`piece[2]` values (check via browser dev tools' Network/Elements panel).
- Cycle through enough games and pieces (e.g. start a few New Games at different sizes) to visually spot-check several of the 27 `h/e/m` combinations render correctly, not as broken image icons.
- Open the Help panel and confirm its piece selector and its valid-neighbors/invalid-neighbors displays also render as faces while Piece Type is Faces.
- Confirm the Freepik attribution link is visible in the Help panel, with the label "Images under license by Freep!k" and pointing to `https://www.freepik.com/free-vector/young-people-expressions-with-different-faces_1250793.htm`.
- While still in Shapes mode (toggle back), reopen the Help panel and confirm the Freepik attribution link is still shown even though Faces mode is not active.
- Toggle Piece Type back to Faces then back to Shapes again and confirm shape rendering is fully restored everywhere (board, tray, Help panel), with no leftover face images.
- Confirm no console errors appear during any of the above steps, including no 404s for any `/faces/*.png` image requests.

## Depends on
- Phase 18 merged.
