# Neighboku — Requirements Specification (AI Rebuild)

## 0. Purpose of this document

This is the behavioral and architectural spec both rebuild tracks (see
[`00-overview.md`](00-overview.md)) must satisfy. It is derived from:

- The full source tree of `alexeieleusis/neighboku` on `main`, read in full for this
  document (all of `src/game/`, `src/components/`, `src/base/`, `src/App.tsx`,
  `src/App.entities.ts`, `src/main.tsx`).
- The repo's own `src/neighboku.md` (in-app documentation) and `fractal_component.md`
  (architecture note).
- The creator's narrated tutorial video (transcript supplied 2026-07-31).
- `backlog.md` and inline `TODO`/`FIXME` comments, which describe known gaps and bugs
  in the original rather than requirements to fix.

This is a **replication** project: where the code, the in-app doc, and the video
disagree, **the code is the source of truth for behavior**. Every such disagreement
found during this pass is called out explicitly in §8 so an AI harness doesn't "fix"
it by accident, and so a human can later decide whether it's worth correcting.

Per-track code-quality improvements (naming, structure, test coverage, type safety)
are intentionally **not** specified here — they are expected to emerge from the
SonarQube/LensFlow/code-review loop described in
[`implementation-plan.md`](implementation-plan.md), not from upfront requirements.
Baking them in here would contaminate the baseline-vs-LensFlow comparison.

## 1. Product overview

Neighboku is a single-player browser puzzle that fuses Sudoku with the attribute-matching
mechanic of *Spot It!*. Pieces are placed on a square grid from a shared tray. Two rules
must hold simultaneously:

- **Sudoku constraint**: no two identical pieces share a row, column, or section.
- **Neighbor rule** (the *Spot It!* fusion): every pair of orthogonally-adjacent pieces
  must share **exactly one** attribute — not zero, not more than one.

The game ships two visual skins for the same underlying attribute space: geometric
**Shapes** (form/border-color/fill-color) and cartoon **Faces** (hair/eyes/mouth). It
supports configurable board sizes (4×4 up to 12×12), an extensive set of optional hints,
drag-and-drop (desktop and mobile) plus a click-to-place fallback, undo, and
preference persistence.

## 2. Glossary

| Term | Meaning |
|---|---|
| Dimension | Number of attribute axes a piece has (e.g. 3: shape, border color, fill color). |
| Base | Number of possible values per attribute axis (e.g. 3 shapes). |
| Piece | A `dimension`-length vector of digits in `[0, base)`; a piece's identity. |
| Section | A sub-grid region (size = the largest prime factor of the board size) within which pieces must be unique, analogous to a Sudoku box. |
| Locked cell | A filled cell that, if uncovered, would have only one legal piece — used by the puzzle generator to decide which cells are safe to blank out. |
| Tray | The strip of remaining, unplaced pieces grouped by type with counts. |
| Telescope / Lens | TelescopeJS primitives: a `Telescope<T>` is a state container with a change stream and `update`/`evolve`; a `Lens<A,B>` focuses a `Telescope<A>` down to a `Telescope<B>` via a getter/setter pair. |
| Fractal component | The project's UI pattern (see §7.2): every component is `state,telescope → useXViewModel → RenderX`, and every child receives a magnified telescope, not raw callbacks. |

## 3. Domain rules

### 3.1 Board and pieces

- A board is `size × size` cells. Each non-empty cell holds a `Piece` (a `dimension`-long
  digit vector, base `base`).
- Board generation (`buildBoard`) fills cells row-major, left-to-right, top-to-bottom.
  For each cell it computes the candidate pieces that satisfy the neighbor rule against
  the cell's already-placed *orthogonal* neighbors (up, left only — later cells aren't
  placed yet) while excluding pieces already used in the same row, column, or section.
  Among the candidates, it prefers the ones used **least frequently so far** on the board
  (a soft global-uniformity heuristic, not a hard rule) and picks randomly among ties. If
  a cell has zero candidates, the whole board build is retried from scratch (no
  backtracking) until one succeeds.
- Rebuild note: reproduce this "generate greedily, retry whole board on dead end"
  strategy rather than introducing backtracking — this is an intentional simplification
  in the original, not an oversight, and changing it would change solvability
  characteristics and generation time in ways that should be a deliberate, reviewed
  decision, not incidental to the rebuild.

### 3.2 Neighbor rule (exact wording)

Two cells are valid neighbors **iff exactly one of their `dimension` attribute positions
has an equal value**. Zero shared attributes or two-or-more shared attributes are both
invalid.

**Adjacency used by the rule is orthogonal only** (up/down/left/right) — see the
discrepancy noted in §8.1.

### 3.3 Row / column / section uniqueness

Within any row, any column, or any section, no piece value may repeat. Section size is
`the largest prime factor of the board size` (e.g. size 9 → sections of 3; size 6 →
sections of 3; size 8 → sections of 2; size 16 → sections of 2). This is computed, not
configured — carry the same derivation forward rather than hardcoding a section-size
table.

### 3.4 Puzzle unfolding (`unfoldGame`)

Starting from a fully-solved board, cells are repeatedly blanked out to build the
playable puzzle:

- On each iteration, find all currently-filled "locked" cells: a filled cell is locked
  if none of the pieces *already removed* (available in the tray) could legally replace
  it — i.e. removing it wouldn't just recreate an already-known ambiguity — **and** it
  is not the sole remaining neighbor of any of its own neighbors (a cell whose removal
  would leave a neighbor with zero placed neighbors is never a candidate for removal, to
  avoid isolating cells).
- Among the locked cells, prefer removing the piece value with the **lowest** removal
  frequency so far when `size > 4`, and the **highest** frequency when `size <= 4`
  (deliberately different tie-breaking for small vs. larger boards — preserve as-is).
- Stop when no locked cells remain.
- **Rebuild note**: the four-tier "Easy/Medium/Hard/Expert" difficulty design described
  in a code comment is aspirational and **not implemented** in the original — only the
  single unparameterized strategy above exists. Replicate the single strategy; do not
  implement the commented-out difficulty tiers as if they were a requirement (see §8.3).
- After unfolding, two caches are (re)computed and must be kept in sync on every mutation:
  `pieceToFitCells` (tray piece value → cells it could legally go in) and
  `cellToFitPieces` (blank cell → pieces that could legally go there).

### 3.5 Placing and undoing a move

- `placePiece(pieceValue, cell, game)`: computes the piece's legality against the
  *current* `pieceToFitCells` cache, decrements the tray count (removing the entry at
  zero), writes the piece into the board, recomputes both fit caches, and appends a
  `Move` (`{ pieceValue, cell, isValid }`) to `placedCells`.
  - If `preferences.preventInvalidMoves` is `true` and the move is invalid, the function
    **throws** rather than mutating state; the caller is responsible for catching this
    and surfacing the invalid-move feedback (see §5.13). If the preference is `false`,
    an invalid move is still recorded (with `isValid: false`) and applied to the board.
- `undoPlay(game)`: pops the last `Move`, returns its piece to the tray, blanks its
  cell, and recomputes both fit caches. Undoing with an empty `placedCells` is
  unhandled in the original (see §8.4) — the rebuild should reproduce this rather than
  add defensive handling, unless the phase reviewer explicitly flags it as worth fixing.

### 3.6 Win / loss detection

The game is considered **solvable** (`gameIsSolvable`) iff all three hold simultaneously:
every placed move so far has `isValid: true`, every blank cell has at least one piece
that could fit it, and every remaining tray piece has at least one cell it could fit.
When the tray becomes empty (`availablePieces.size === 0`), the game-finished dialog is
shown, using `gameIsSolvable` to pick a success or failure state.

## 4. Board sizes, defaults, and preferences

### 4.1 Selectable board sizes

The New Game panel offers exactly these sizes: **4×4, 6×6, 8×8, 9×9, 12×12**.
Selecting a size updates `dimension`: for `size < 8` the dimension is left unchanged
(whatever it currently is); for `size >= 8` it is forced to `3`. `base` is not changed
by the size selector at all in the observed code path — carry this exact rule forward
even though it looks asymmetric; it is what the original does.

### 4.2 Default preferences (on first load, no stored preferences)

```
scalars: { base: 3, dimension: 3, size: 6 }
pieceType: Shapes
hintFitPieceCount: true
hintPieceCells: false
hintFitOnDrag: true
showFitPiecesOnHover: true
hintAvailablePiecesCount: true
hintAvailablePieceUniqueCell: true
preventInvalidMoves: true
hintGameIsSolvable: true
sound: true
```

### 4.3 Persistence

Preferences are persisted to `localStorage` under a fixed key (a hardcoded UUID string
in the original — the rebuild may use any stable key, compatibility with the exact
original key is not required) on every change, and merged over the defaults on load
(so a partial/older stored object doesn't crash). Loading also **forces `dimension: 3`**
on the loaded scalars regardless of stored value — reproduce this as observed rather
than treating it as obviously a bug (see §8.5). The board/game itself is **not**
persisted — every page load starts a fresh board from the (loaded) preferences.

## 5. UI / UX requirements

### 5.1 Shell and theming

- Single page, dark Material UI theme **forced** regardless of OS/browser preference
  (`createTheme({ palette: { mode: "dark" } })`, always applied).
- Top bar (left to right, observed order): drag-fit-hint icon, Preferences button,
  New Game button, Undo button, solvability icon, Help button.
- Below the top bar: the board, then the piece tray, both inside a shared
  `DndContext` so drag-and-drop works across them.
- A Snackbar for invalid-move errors and a Dialog for game-finished state overlay the
  shell (see §5.13, §5.14).
- Favicon is a rendering of the first game piece (not the default Vite icon).

### 5.2 Board rendering

- Grid of cells, one row per board row, laid out via CSS grid.
- Cells are colored to visually group sections (background color keyed to section, per
  `CellDisplay`'s `backgroundColor`/`gridRow`/`gridColumn` view-model fields) — exact
  color values are a styling decision for the rebuild, but the section grouping must be
  visually legible.
- A blank cell shows its `pieceType`-appropriate droppable target; if
  `hintFitPieceCount` is on, it shows the count of pieces that would legally fit there;
  if `showFitPiecesOnHover` is on, hovering/tapping a blank cell reveals a tooltip
  listing every piece that would fit.
- A filled cell renders its piece via the shared piece-rendering component (§5.3/§5.4).

### 5.3 Piece rendering — Shapes mode

Piece digit 0 (`piece[0]`) selects the form:

| `piece[0]` | Shape |
|---|---|
| 0 | Circle (r=15, stroke 5) |
| 1 | Equilateral triangle (stroke 4) |
| 2 | Square/rect (stroke 10) |

Stroke (foreground/border) color is keyed by `piece[1]`: `0→red, 1→dodgerblue,
2→mediumseagreen`. Fill (background) color is keyed by `piece[2]` when the piece has a
third dimension (`0→aquamarine, 1→yellow, 2→purple`); for 2-dimensional pieces the fill
falls back to the same color as the stroke. These are the three attributes referenced by
the neighbor rule and the video's "form, border, color" description.

### 5.4 Piece rendering — Faces mode

- Piece is rendered as an image `/faces/h{h}e{e}m{m}.png` where `h/e/m` are
  `piece[0]/piece[1]/piece[2]` — hair color, eye expression, mouth expression, matching
  the video's description.
- Requires the 27 (`3×3×3`) face PNGs under `public/faces/`, sourced under a Freepik
  license. The Help panel (§5.11) must attribute them: a link to
  `https://www.freepik.com/free-vector/young-people-expressions-with-different-faces_1250793.htm`
  labeled "Images under license by Freep!k". Re-verify the exact face asset license
  terms before shipping the rebuild publicly — don't assume the original attribution
  text is complete/current without checking.
- `PieceType` (Shapes/Faces) is a user preference (§4.2), toggled in the Preferences
  panel, applied uniformly across board, tray, and Help panel piece displays.

### 5.5 Available pieces tray

- One column per distinct remaining piece value, sorted ascending by the piece's
  base-10-encoded value.
- Each column shows: the draggable piece image, the remaining count, and — if
  `hintAvailablePieceUniqueCell` is on **and** the count of legal fit-cells for that
  piece equals its remaining count — an appended `*` (the "this piece's placement is
  now forced" hint described in the video).
- If `hintPieceCells` is on, each column also lists a button per legal fit-cell (labeled
  with 1-indexed `row,column`) that places the piece there on click — this is the
  keyboard/click-friendly alternative to drag-and-drop and must be preserved even though
  it isn't mentioned in the tutorial video.
- Tray width scales with board size (`56px × size`).

### 5.6 Drag and drop

- Built on `@dnd-kit/core`; must work with both desktop pointer and mobile touch input.
- While a piece is being dragged over a cell, the piece being dragged communicates a
  `DragHint` (`None | Unknown | Ok | NotOk`) up to the top-bar icon via a dedicated
  telescope (not component props/callbacks) — `Ok`/`NotOk` only when `hintFitOnDrag` is
  on and the piece is over a droppable target; `Unknown` while dragging without hovering
  a target; `None` otherwise. The top-bar icon shows: info icon (None/Unknown), thumbs
  up (Ok), thumbs down (NotOk).
- Dropping over a valid `cell-{row}-{col}` droppable invokes the same placement path as
  click-to-place.

### 5.7 Undo

- Icon button, disabled iff `placedCells` is empty.
- Restores the piece to the tray and blanks the cell (§3.5); recomputes fit caches.

### 5.8 Preferences panel

Bottom drawer, opened via the gear icon. One `Switch` per preference, all mutually
independent:

| Label | Preference key |
|---|---|
| Piece Type: Shapes or Faces | `pieceType` |
| Hint Fit Piece Count | `hintFitPieceCount` |
| Hint Fit Piece Unique Cell | `hintAvailablePieceUniqueCell` |
| Hint Piece Cells | `hintPieceCells` |
| Hint Fit On Drag | `hintFitOnDrag` |
| Show Fit Pieces on Hover | `showFitPiecesOnHover` |
| Prevent Invalid Moves | `preventInvalidMoves` |
| Hint Game Is Solvable | `hintGameIsSolvable` |
| Sound | `sound` |

Every toggle persists immediately (§4.3). Note: `sound` exists as a preference with no
observed audio implementation anywhere in the source — see §8.6.

### 5.9 New Game panel

Bottom drawer, opened via a "new" icon. A single Board Size select (options in §4.1) and
a Start button. Starting a new game rebuilds the board from current preferences,
unfolds a fresh puzzle, resets `gamePlay.startTime`, and closes the panel.

### 5.10 Help panel

Top drawer, opened via the help icon. Contains, in order:

1. A piece selector (`Select`, all pieces of the current `base`/`dimension`, rendered
   via the shared piece display).
2. The set of pieces that **are** valid neighbors of the selected piece (computed via
   `buildPossibleNeighbors` with no exclusions), under a "valid neighbors" grouping icon.
3. The set of pieces that are **not** valid neighbors of the selected piece (full
   candidate space minus the valid set), under an "invalid neighbors" grouping icon.
4. A link to the English tutorial video.
5. A link to the Spanish tutorial video ("Tutorial en Español").
6. The Freepik face-image attribution link (§5.4) — shown regardless of current
   `pieceType`, since it's a static credit, not conditional on Faces mode being active.

This is the feature described in the video as "select any piece… the app will visually
show which other pieces can be its neighbors."

### 5.11 Hints summary (cross-reference)

| Hint | Preference | Behavior |
|---|---|---|
| Fit count per cell | `hintFitPieceCount` | §5.2 |
| Fit pieces on hover | `showFitPiecesOnHover` | §5.2 |
| Unique-cell asterisk | `hintAvailablePieceUniqueCell` | §5.5 |
| Click-to-place cell list | `hintPieceCells` | §5.5 |
| Drag ok/not-ok icon | `hintFitOnDrag` | §5.6 |
| Solvability face icon | `hintGameIsSolvable` | §5.13 |
| Prevent invalid moves | `preventInvalidMoves` | §3.5 |

### 5.12 Invalid-move feedback

When `placePiece` throws (§3.5), show a `Snackbar` with an "Invalid move!" error alert,
auto-hiding after 6 seconds or on manual close.

### 5.13 Solvability indicator and game-finished dialog

- If `hintGameIsSolvable` is on, the top bar shows a happy-face icon when
  `gameIsSolvable` (§3.6) is true, a sad-face icon otherwise; nothing is shown when the
  preference is off.
- When the tray empties, a Dialog appears: success alert with an elapsed-time string
  (`{h}h {m}m {s}s` since the game started) if solvable, a failure alert if not. The
  video's guidance ("press undo until the happy face reappears") describes the intended
  player recovery loop when the sad face is showing — no forced-undo mechanic exists,
  it's purely a hint.

## 6. Persistence

See §4.3 for what is persisted (preferences only) and §9 for the full list of
persistence-adjacent features that are out of scope (accounts, scores, history).

## 7. Non-functional / architecture requirements

### 7.1 Technology stack (versions approximate — pin to current majors at rebuild time)

React 19, TypeScript ~5.7 (strict), Vite 6 (`@vitejs/plugin-react-swc`), MUI 6
(`@mui/material`, `@mui/icons-material`, `@emotion/*`), `@dnd-kit/core` 6, `telescopejs`
0.1.x, `rxjs` 7 (a TelescopeJS peer dependency, not used directly in application code as
observed), Vitest 2 + `@vitest/coverage-v8`, ESLint 9 + `typescript-eslint`, Prettier 3,
Yarn as the package manager (`packageManager` pinned in `package.json`).

### 7.2 Fractal component architecture — mandatory

Every stateful UI component **must** follow the pattern in `fractal_component.md`
(copied into each rebuild repo, see the implementation plan): a component function that
does nothing but `return RenderX(useXViewModel(props))`; a `useXViewModel` hook that
turns `TelescopedProps<TState>` into a plain `TViewModel` (all derived data and
event-handler closures precomputed there, not in the render function); a `RenderX`
function that is purely declarative JSX with no business logic. Parent-to-child state
flow goes through a **magnified telescope** (`telescope.magnify(new Lens(get, set))`),
not through raw props-drilling of callbacks — this is the load-bearing convention that
makes every component independently testable and swappable, and it is exactly the kind
of structural invariant a reviewer (human or AI) should treat as a blocking finding when
violated, not a style nit.

#### 7.2.1 Additive refinement: splitting `useXViewModel` internally

This layers on top of the pattern above — it does not replace it. The outer contract
(`state,telescope → useXViewModel → RenderX`, magnified-telescope parent→child flow)
stays exactly as described in §7.2 and `fractal_component.md`. What changes is what
happens *inside* `useXViewModel` for any component whose view-model logic is non-trivial:
split it into narrower pieces per the split-hook convention documented at
`~/.harness/knowledge/patterns/react/` (start with `QUICK_REF_PATTERNS.md`, the full
rationale is in `COMPONENT_ORGANIZATION_CONVENTION.md`) — those files are the source of
truth used during actual implementation; this section only records how the two patterns
compose. See §7.4 for where each of the three pieces below physically lives on disk
(`useComponentNameDomain.ts` / `useComponentNameState.ts` / `useComponentNameActions.ts`):

- **`useXDomain`** — not a hook at all: a module of pure functions (no React, no
  telescope imports) holding the component-local business rules and derived-value
  calculations. This extends the existing domain boundary already required by §7.4
  (`src/game/` has zero React/UI imports) down to component-level logic that's specific
  to one component and doesn't belong in the shared game layer.
- **`useXState`** — local, non-telescope UI state (`useState`/`useMemo`: dialog
  open/closed, hover index, drag phase) plus values derived from the magnified
  telescope's current state via `useXDomain` functions. Returns an *internal* shape that
  includes setters; the orchestrator strips setters before the view model reaches
  `RenderX` — component-external consumers only ever see public state.
- **`useXActions`** — event-handler closures only, one per user interaction. Each action
  curries a `useXDomain` function with current state/telescope, then calls
  `telescope.update`/`.evolve` to commit — this is this project's equivalent of the
  convention's "mutations hook," since there's no backend/API layer here, only local
  telescope writes. No business logic lives directly in an action body; if you're
  writing an `if` that isn't just "did the domain check pass," it belongs in
  `useXDomain` instead.

`useXViewModel` itself becomes the orchestrator: it composes `useXState` +
`useXActions` + any domain-derived values and returns `TViewModel`. It must stay
wiring-only, the same way `RenderX` stays declarative-only.

This is a scale rule, not a mandate to fragment every component into four files — a
simple leaf component (e.g. `UndoButton`) can keep one flat `useXViewModel` with no
split. A reviewer should flag over-splitting a trivial component as readily as
under-splitting a complex one. Storybook-style catalog stories (same source convention)
are out of scope for the stack pinned in §7.1 unless a later phase adopts them.

### 7.3 State management and immutability

All domain and view-model types are `readonly`/`ReadonlyArray`/`ReadonlyMap` at every
level observed in the original (`entities.ts`, all component `.entities.ts` files).
Updates are always expressed as new objects via spread, never in-place mutation, even
for `Map`s (`new Map(existing.entries())` then `.set`). Preserve this discipline; it is
a precondition for the telescope/lens model to behave correctly, not an incidental style
choice.

### 7.4 Code organization conventions

- One `ComponentName.tsx` (component + `RenderComponentName`) paired with
  `ComponentName.types.ts` (props type, view-model type — types only, no hook logic)
  and one or more `useComponentName*.ts` hook files per UI unit — no inline prop/
  view-model types in the `.tsx` file. This supersedes `fractal_component.md`'s original
  single `ComponentName.entities.ts` (which bundled types and the view-model hook
  together in one file): adopt the knowledge convention's components/types/hooks file
  separation (`~/.harness/knowledge/patterns/react/`) instead. A trivial component keeps
  one `useComponentNameViewModel.ts`; a non-trivial component splits that, per §7.2.1's
  scale rule, into `useComponentNameDomain.ts` / `useComponentNameState.ts` /
  `useComponentNameActions.ts` / `useComponentNameViewModel.ts`.
- Domain logic lives under `src/game/` (`entities.ts`, `common.ts`, `boardBuilder.ts`,
  `gameBuilder.ts`) with zero React/UI imports — keep this boundary; it's what makes the
  domain layer unit-testable without a DOM.
- Named function components/hooks throughout (no default exports, no anonymous
  arrow-function components) — this was an explicit, deliberate refactor in the original
  history ("Renamed render functions to enable linters" / "Refactors components to use
  named functions"), not incidental.
- Prettier-formatted; ESLint `recommended` + `typescript-eslint recommended` +
  `react-hooks recommended` + `react-refresh` (`only-export-components` as a warning).

### 7.5 Testing baseline

The original has exactly one test file (`src/game/__tests__/boardBuilder.test.ts`),
covering `findNeighbors`, `findExclusions`, `buildPossibleNeighbors`, `validNeighbors`,
and a smoke test of `buildBoard`. Vitest + `@vitest/coverage-v8` are wired up
(`npm run test` / `npm run coverage`) but coverage is not enforced anywhere. Treat this
as the **floor**, not the target — matching it satisfies strict replication.

**Testing pyramid (additive, not mandated by this behavioral spec).** Beyond that floor,
apply the testing-priority order from
`~/.harness/knowledge/patterns/react/QUICK_REF_PATTERNS.md` § Testing Priority to every
new component built during the rebuild, mapped onto this project's hook split (§7.2.1):
domain-function tests (§3's domain layer rewards this highest-priority tier), then
`useXState`/`useXActions` hook tests, then a `useXViewModel` integration test, then
`RenderX` component tests where conditional rendering is non-trivial. This project has
two genuine real-browser cases beyond that: `@dnd-kit` drag-and-drop (Phases 8–9, 14) and
the hover-triggered fit-piece tooltip (§5.2, Phase 12) need interaction tests;
`PieceDisplay`'s shape/color rendering (§5.3) and the Faces image grid (§5.4) are
screenshot-test candidates. Note the original stack (§7.1) has no browser-mode Vitest
setup, so standing that up is a Phase 0 addition if this tier is adopted — it's an
architecture-convention standard for the harness to hold new-component phases to (same
open enforcement question as fractal-component conformance, §7.2/§7.2.1), not a
requirement of this document's behavioral floor.

### 7.6 Device support

Must support both desktop pointer-based drag and mobile touch-based drag (the original
added mobile support as its own follow-up commit — treat it as its own phase, not an
assumed side effect of the desktop drag work).

## 8. Known discrepancies and open decisions

These are flagged so the AI harness doesn't "helpfully" resolve them unilaterally, and
so a human reviews the choice at the relevant phase instead.

### 8.1 Diagonal neighbors claim (doc/video) vs. orthogonal-only (code)

`src/neighboku.md` and the tutorial video both state the neighbor rule "applies to all
neighboring cells (horizontal, vertical, and diagonal)". The actual implementation
(`findGameNeighbors`, `findNeighbors`) only ever considers up/down/left/right. **Decision
for the rebuild: replicate the code's orthogonal-only behavior** (it's the actual,
tested, shipped game rule); the descriptive text can be carried forward as-is (it's
pre-existing content, not a functional requirement) or corrected — flag this choice
explicitly to the human reviewer at Phase 18 (Help panel / in-app docs).

### 8.2 "16x6" in the video transcript

The narrated video says board sizes go up to "16x6"; the code's actual largest option is
**12×12** (all board-size options are square — see §4.1). Treat the transcript as an
oral slip, not a requirement; **12×12** is authoritative.

### 8.3 Difficulty levels are unimplemented

A code comment in `gameBuilder.ts` describes four difficulty tiers (Easy/Medium/Hard/
Expert) as a `TODO`; none of them are implemented — `unfoldGame` runs one unparameterized
strategy regardless of any difficulty setting (there is no difficulty preference in the
UI at all). Replicate the single strategy only (§3.4).

### 8.4 `undoPlay` on an empty move list

`undoPlay` indexes `placedCells[placedCells.length - 1]` without checking for emptiness;
in the UI this is masked because the Undo button is disabled when `placedCells` is empty
(§5.7), so the unsafe path is unreachable through normal play. Replicate the UI guard;
don't add defensive handling inside `undoPlay` itself.

### 8.5 Forced `dimension: 3` on preference load

`main.tsx` unconditionally overwrites the loaded/stored `dimension` with `3` when
applying stored preferences, even though `NewGamePanel`'s own size-change handler treats
`dimension` as size-dependent (§4.1). Net effect: after a reload, `dimension` is always
3 regardless of what was last selected. Replicate this behavior; it doesn't visibly
break gameplay because the size options that make `dimension` matter (`size < 8`) are
the minority, and no size option was observed to actually rely on a non-3 dimension in
the default flow.

### 8.6 `sound` preference has no implementation

`sound` is a real, persisted, toggleable preference with a visible UI switch, but no
audio playback, `Audio` element, or sound-asset loading exists anywhere in the source.
Replicate the preference (toggle + persistence) without inventing audio behavior that
never existed.

### 8.7 `backlog.md` open items

- "The comparisons everywhere are by reference, not by value, which causes unexpected
  behavior" — a known, acknowledged correctness gap in the original (arrays compared by
  identity in places that likely intend value equality). Reproduce the current behavior;
  do not silently switch to value-equality comparisons as part of the base rebuild —
  flag it to the reviewer during the relevant domain-logic phase (§3, Phases 1–3) so a
  human decides whether it's in scope for that track's "emergent improvement" budget.
- "Extend CellContainer to display pieces that could be placed on the board" — this line
  item predates and is superseded by the shipped `showFitPiecesOnHover`/
  `hintFitPieceCount` features (§5.2); treat it as already resolved by later commits, not
  as outstanding scope.

## 9. Out of scope

No backend/server, accounts, multiplayer, leaderboards, scoring history, monetization,
analytics, or internationalization beyond the two hardcoded tutorial-video links. No CI
pipeline existed in the original (`.github/` is empty) — adding one is an optional
Phase 0 decision (see the implementation plan), not a functional requirement of the game
itself.
