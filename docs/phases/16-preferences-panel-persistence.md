# Phase 16 — Preferences panel & persistence

## Scope (files this phase may create/modify)
- src/App.tsx
- src/App.types.ts
- src/useAppDomain.ts
- src/useAppState.ts
- src/useAppActions.ts
- src/useAppViewModel.ts
- src/components/PreferencesDisplay/PreferencesDisplay.tsx
- src/components/PreferencesDisplay/PreferencesDisplay.types.ts
- src/components/PreferencesDisplay/usePreferencesDisplayDomain.ts
- src/components/PreferencesDisplay/usePreferencesDisplayState.ts
- src/components/PreferencesDisplay/usePreferencesDisplayActions.ts
- src/components/PreferencesDisplay/usePreferencesDisplayViewModel.ts
- src/components/PreferencesDisplay/PreferencesDisplay.stories.tsx
- src/components/PreferencesDisplay/__tests__/*
- src/main.tsx

## Requirements

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §4.2 (Default preferences), quoted verbatim in full:

> ### 4.2 Default preferences (on first load, no stored preferences)
>
> ```
> scalars: { base: 3, dimension: 3, size: 6 }
> pieceType: Shapes
> hintFitPieceCount: true
> hintPieceCells: false
> hintFitOnDrag: true
> showFitPiecesOnHover: true
> hintAvailablePiecesCount: true
> hintAvailablePieceUniqueCell: true
> preventInvalidMoves: true
> hintGameIsSolvable: true
> sound: true
> ```

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §4.3 (Persistence), quoted verbatim in full:

> ### 4.3 Persistence
>
> Preferences are persisted to `localStorage` under a fixed key (a hardcoded UUID string
> in the original — the rebuild may use any stable key, compatibility with the exact
> original key is not required) on every change, and merged over the defaults on load
> (so a partial/older stored object doesn't crash). Loading also **forces `dimension: 3`**
> on the loaded scalars regardless of stored value — reproduce this as observed rather
> than treating it as obviously a bug (see §8.5). The board/game itself is **not**
> persisted — every page load starts a fresh board from the (loaded) preferences.

Excerpt, `docs/neighboku-ai-rebuild/requirements.md` §5.8 (Preferences panel), quoted verbatim in full:

> ### 5.8 Preferences panel
>
> Bottom drawer, opened via the gear icon. One `Switch` per preference, all mutually
> independent:

**⚠ Type mismatch in quoted §5.8:** The quote above states "One `Switch` per preference", but `pieceType` (§4.2) is a string value (`"Shapes"` | `"Faces"`), not a boolean. A `Switch` cannot correctly represent this categorical choice. See the explicit correction below.

> | Label | Preference key |
> |---|---|
> | Piece Type: Shapes or Faces | `pieceType` |
> | Hint Fit Piece Count | `hintFitPieceCount` |
> | Hint Fit Piece Unique Cell | `hintAvailablePieceUniqueCell` |
> | Hint Piece Cells | `hintPieceCells` |
> | Hint Fit On Drag | `hintFitOnDrag` |
> | Show Fit Pieces on Hover | `showFitPiecesOnHover` |
> | Prevent Invalid Moves | `preventInvalidMoves` |
> | Hint Game Is Solvable | `hintGameIsSolvable` |
> | Sound | `sound` |
>
> Every toggle persists immediately (§4.3). Note: `sound` exists as a preference with no
> observed audio implementation anywhere in the source — see §8.6.

**Correction to §5.8 — `pieceType` control type:** `pieceType` is a string value (`"Shapes"` | `"Faces"`) per §4.2, not a boolean. A `Switch` is inherently boolean and cannot correctly represent a categorical choice. Use a MUI `SegmentedControl` (via `Select` with `SelectAdornment` or `RadioGroup` with two options laid out horizontally) for the `pieceType` row, with options "Shapes" and "Faces". All remaining 8 preferences are boolean and use a `Switch` as specified above.

**Two explicit discrepancies to reproduce as observed, not "fix" (requirements.md §8.5, §8.6):**

`main.tsx`'s preference-loading logic must **unconditionally overwrite** the loaded/stored
`dimension` with `3`, regardless of what value was actually stored — even though this
looks inconsistent with a size-dependent `dimension` rule (§4.1: for `size >= 8`, `dimension`
is forced to `3`; for `size < 8`, `dimension` is left unchanged by the size selector). That
size-dependent handler lives in `NewGamePanel`, which is Phase 17 scope and does not exist
yet at this phase — this phase's job is only to reproduce the unconditional load-time
override in `main.tsx` exactly as `requirements.md` §8.5 describes it, not to reconcile it
with the not-yet-built size selector's own logic. Do not add a conditional, a `TODO`, or any
"smarter" merge for `dimension` — always `3` on load, full stop.

`sound` is a toggle-and-persist-only preference (§8.6): it must appear as a `Switch` in the
Preferences drawer, and its value must read from and write to `localStorage` exactly like
every other preference. No audio playback, no `Audio` element, no sound asset, and no
`import`/reference to any audio file may be added anywhere in this phase's diff — there is
no observed audio implementation in the original to replicate, and inventing one is out of
scope.

**Boundary this phase must implement (not part of the literal excerpts above):** the top-bar
Preferences button (gear icon) already exists as an inert placeholder from Phase 4's shell
skeleton (`requirements.md` §5.1's observed top-bar order: drag-fit-hint icon, Preferences
button, New Game button, Undo button, solvability icon, Help button). This phase wires that
button to open/close a new bottom `Drawer` containing `PreferencesDisplay`, following the
same shape as Phase 15's `App`-owned Dialog open/closed state: the drawer's open/closed flag
lives in `useAppState.ts`, the open/close handler(s) in `useAppActions.ts`, and
`PreferencesDisplay` receives the current preferences slice of `AppState` through a magnified
telescope (`telescope.magnify(new Lens(get, set))`) — not raw props/callbacks — so each
control's `onChange` (the 8 `Switch` toggles and the `pieceType` SegmentedControl) commits directly back into `AppState.preferences` via
`telescope.update`/`.evolve`.

Persistence itself (§4.3) is `main.tsx`'s responsibility, not `PreferencesDisplay`'s:
`PreferencesDisplay` only ever reads/writes the in-memory `AppState.preferences` slice
through its magnified telescope. `main.tsx` defines the default-preferences object literal
from §4.2 above, reads any existing value under one fixed, stable `localStorage` key at
startup, merges the parsed stored object over the defaults (so a missing key, an
older/partial shape, or an absent key entirely all fall back to the matching default rather
than crashing), forces the merged `dimension` to `3` per §8.5 above, and uses the result as
the initial `preferences` field of the `AppState` passed to `Telescope.of(...)`. `main.tsx`
then extends its existing per-emission subscription (`telescope.stream.forEach(...)`, which
already re-renders on every state change) to also write the current `state.preferences` to
that same fixed `localStorage` key on every emission — so every preference change, from any
source, persists immediately without `PreferencesDisplay` needing its own persistence logic.
Per §4.3's last sentence, the board/game itself (`Board`, `Game`, `placedCells`, etc.) is
explicitly excluded from this persistence: only the `preferences` slice is read from or
written to `localStorage`, and every page load builds a fresh board from the loaded
preferences via the existing board-generation path (Phases 2–3), never from a persisted
board/game snapshot.

`PreferencesDisplay` itself has 9 mutually independent controls (§5.8's table — 8 `Switch` toggles plus 1 SegmentedControl for `pieceType`) plus the
load/persist side effects described above, which per `docs/CONVENTIONS.md`'s scale rule
("real local state, user actions, or business rules") makes it a **non-trivial** component:
it must use the full `usePreferencesDisplayDomain.ts` / `usePreferencesDisplayState.ts` /
`usePreferencesDisplayActions.ts` / `usePreferencesDisplayViewModel.ts` split, not a single
flat view-model hook. `usePreferencesDisplayDomain.ts` holds the pure per-control update
functions (e.g. given the current preferences object and a key, return a new preferences
object with that key flipped or set to a new value — no React, no telescope imports).
`usePreferencesDisplayState.ts` derives the 9 rows' current checked/selected values from the
magnified telescope's current state via the domain functions. `usePreferencesDisplayActions.ts`
holds one event-handler closure per control (each currying a domain function with the
current telescope, then committing via `telescope.update`/`.evolve`) — no business logic
directly in an action body. `usePreferencesDisplayViewModel.ts` is the wiring-only
orchestrator composing the three into the row list `RenderPreferencesDisplay` renders.
`PreferencesDisplay.types.ts` holds only the props type and view-model type, no hook logic,
per `docs/CONVENTIONS.md`'s file-layout convention.

## Acceptance criteria
- The Preferences drawer (a MUI `Drawer` anchored to the bottom, per §5.8) opens when the top-bar gear icon (Preferences button) is clicked and closes on dismissal, replacing Phase 4's inert placeholder with real open/close behavior.
- The drawer renders exactly 9 rows in §5.8's table order, each labeled with the table's exact label text and bound to the correct preference key: Piece Type: Shapes or Faces → `pieceType` (rendered as a SegmentedControl with "Shapes" and "Faces" options, writing the selected string value to the `pieceType` preference), followed by 8 `Switch` rows: Hint Fit Piece Count → `hintFitPieceCount`, Hint Fit Piece Unique Cell → `hintAvailablePieceUniqueCell`, Hint Piece Cells → `hintPieceCells`, Hint Fit On Drag → `hintFitOnDrag`, Show Fit Pieces on Hover → `showFitPiecesOnHover`, Prevent Invalid Moves → `preventInvalidMoves`, Hint Game Is Solvable → `hintGameIsSolvable`, Sound → `sound`.
- Every one of the 9 controls is mutually independent (changing one never changes another) and commits its new value into `AppState.preferences` via a magnified telescope, not via prop-drilled callbacks.
- `main.tsx` persists the current `preferences` slice of `AppState` to `localStorage` under one fixed, stable key on every state emission (i.e., after every preference change, immediately, with no separate "save" action required).
- `main.tsx`'s load-time logic merges any stored preferences object over the §4.2 defaults object so that a missing key, an empty stored object, or a stored object from an older/partial preferences shape all resolve to a fully-populated, correctly-typed `Preferences` value without throwing or crashing the app.
- `main.tsx`'s load-time logic unconditionally forces the merged `scalars.dimension` to `3` regardless of what value (if any) was present in the stored object — this exact override is implemented even though it is inconsistent with `NewGamePanel`'s (Phase 17, not yet built) own size-dependent dimension rule, per §8.5.
- The `sound` preference toggles and persists exactly like every other preference, and no audio playback code, `Audio` element, sound asset import, or reference to any audio file exists anywhere in this phase's diff, per §8.6.
- The board/game state (`Board`, `Game`, `placedCells`, and related in-progress-play state) is never read from or written to `localStorage` by this phase's code — every page load constructs a fresh board from the loaded preferences via the existing board-generation path, not from a persisted board/game snapshot.
- `PreferencesDisplay` is split into `usePreferencesDisplayDomain.ts` (pure functions, no React/telescope imports), `usePreferencesDisplayState.ts` (telescope-derived row state via the domain functions), `usePreferencesDisplayActions.ts` (one event-handler closure per control, each committing via `telescope.update`/`.evolve` with no business logic in the handler body), and `usePreferencesDisplayViewModel.ts` (wiring-only orchestrator) — per `docs/CONVENTIONS.md`'s non-trivial scale rule for a 9-control component with persistence side effects.
- `PreferencesDisplay.types.ts` holds only its props type and view-model type, with no hook logic, per `docs/CONVENTIONS.md`'s file-layout convention; `PreferencesDisplay` still follows the `state,telescope → usePreferencesDisplayViewModel → RenderPreferencesDisplay` fractal pattern (`requirements.md` §7.2).
- Phase 11's invalid-move Snackbar path is re-verified working end-to-end through the real `preventInvalidMoves` `Switch` in the Preferences panel (toggling it off, then attempting an invalid placement, opens the "Invalid move!" Snackbar exactly as Phase 11 specified), with no reliance on the old manual `localStorage`-edit or default-value-edit workaround Phases 11/14 documented as a stand-in.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with no errors.

## Manual test checklist
- Run `pnpm dev`, load the app in a browser, and open the Preferences drawer via the top-bar gear icon.
- Change all 9 preferences (set Piece Type to "Faces", toggle Hint Fit Piece Count, Hint Fit Piece Unique Cell, Hint Piece Cells, Hint Fit On Drag, Show Fit Pieces on Hover, Prevent Invalid Moves, Hint Game Is Solvable, Sound) away from their defaults in one session, then reload the page once and confirm the Preferences drawer shows every one of the 9 new values, confirming they persisted to `localStorage` as a single blob (per §4.3, one write on every change, not 9 independent keys).
- With the Preferences drawer open, use the browser devtools to directly edit the persisted preferences object in `localStorage` and set `scalars.dimension` to a value other than 3 (e.g. 5), then reload the page one or more times; confirm that after every such reload the app's active `dimension` is always exactly 3 regardless of the value written into `localStorage` (the §8.5 forced-`dimension:3` quirk) — this is an explicit, must-pass step, not incidental.
- Clear the persisted preferences key from `localStorage` entirely (simulating first load) and reload; confirm the app starts with the exact §4.2 defaults and shows no console errors.
- With devtools, write a partial/older-shaped preferences object into `localStorage` (e.g. only `{ "sound": false }`, omitting every other key) and reload; confirm the app loads without crashing, the Preferences drawer shows `Sound` off and every other control at its correct default value (including `pieceType` set to "Shapes"), and no console errors appear.
- Place a few pieces on the board, then reload the page without changing any preference; confirm the board/game itself was not restored (a fresh board/puzzle is generated from the loaded preferences on every reload) — i.e., the previously-placed moves are gone.
- In the Preferences panel, toggle `Prevent Invalid Moves` off, then attempt to place a piece in a way that violates the neighbor rule or row/column/section uniqueness; confirm the "Invalid move!" Snackbar appears and auto-hides after 6 seconds (or dismisses on manual close), using the real Preferences-panel toggle rather than the old manual `localStorage`/default-value-edit workaround Phases 11 and 14 relied on.
- Confirm the browser devtools console shows no errors throughout the entire checklist above.

## Depends on
- Phase 15 merged.
