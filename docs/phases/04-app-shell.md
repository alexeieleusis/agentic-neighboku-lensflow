# Phase 04 — Fractal component base + app shell skeleton

## Scope (files this phase may create/modify)
- src/base/TelescopeComponent.ts
- src/base/DndKitInterfaces.ts
- src/App.tsx
- src/App.types.ts
- src/main.tsx

## Requirements

The section numbers below derive from `docs/neighboku-ai-rebuild/requirements.md`.
Only the sections relevant to this phase are reproduced here; the gaps (e.g. 5.2–7.1)
are covered in other phase files or in the parent requirements document. Cross-
references to sections not defined in this file resolve as follows:

- §5.13 (Snackbar for invalid-move errors) and §5.14 (Dialog for game-finished
  state) — defined in the parent `requirements.md`; the Snackbar and Dialog are
  shell overlay elements introduced in this phase and wired in later phases
  (see phases 11 and 15).
- §7.1 (Tech stack) — defined in the parent `requirements.md`; lists the original
  dependency majors (MUI v6, `eslint-plugin-react-hooks`, `@vitejs/plugin-react-swc`,
  etc.). See `docs/CONVENTIONS.md` "Dependency-freshness notes" for what has changed
  in this repo (e.g. MUI v9). Storybook catalog stories are out of scope for this
  stack unless a later phase explicitly adopts them.
- §7.4 (Code organization conventions / domain boundary) — excerpted in
  `docs/phases/01-domain-core.md`; governs file layout (`ComponentName.tsx`,
  `ComponentName.types.ts`, `useComponentName*.ts`) and the domain boundary
  (`src/game/` has zero React/UI imports).

### 5.1 Shell and theming

- Single page, dark Material UI theme **forced** regardless of OS/browser preference
  (`createTheme({ palette: { mode: "dark" } })`, always applied).
- Top bar (left to right, observed order):
  - **drag-fit-hint icon**: MUI `OpenInNew` (rotated 45°) representing rotate-to-fit gesture;
    `aria-label="Rotate piece to fit"`; purely decorative with a tooltip on hover
    ("Drag to place; right-click or swipe to rotate").
  - Preferences button
  - New Game button
  - Undo button
  - **solvability icon**: MUI `CheckCircle` (solvable) or `ReportGProblem` (unsolvable);
    `aria-live="polite"` with `aria-label="Position is solvable"` or
    `aria-label="No solution exists"`; purely decorative indicator (no click handler).
  - Help button
- Below the top bar: the board, then the piece tray, both inside a shared
  `DndContext` so drag-and-drop works across them.
- A Snackbar for invalid-move errors and a Dialog for game-finished state overlay the
  shell (see §5.13, §5.14).
- Favicon is a rendering of the first game piece (not the default Vite icon).

(Favicon itself is deferred to a later phase — see the implementation plan's Phase 20.
This phase only needs the shell structure above; it does not need to produce the
piece-rendered favicon.)

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
`docs/patterns/react/` (start with `QUICK_REF_PATTERNS.md`, the full rationale is in
`COMPONENT_ORGANIZATION_CONVENTION.md`) — those files are the source of truth used during
actual implementation; this section only records how the two patterns compose. See §7.4 for where each of the three pieces below physically lives on disk
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

All domain and view-model types are `readonly`/`ReadonlyArray`/`ReadonlyMap` at every level
(full excerpt and rationale in `docs/phases/01-domain-core.md`) — this phase's new
`App.types.ts`/shell state follows the same discipline: updates via spread, never in-place
mutation, even for `Map`s.

## Acceptance criteria
- `App.tsx` follows the `state,telescope → useXViewModel → RenderX` pattern: the exported `App` component function body does nothing but call `useAppViewModel(props)` and pass the result to `RenderApp`; no derived-data computation, no event-handler bodies, and no business logic live inline in `App.tsx` or in `RenderApp` itself.
- `App.types.ts` holds only the `AppState` (or equivalent props/view-model) types for the shell — no hook logic — per `docs/CONVENTIONS.md`'s file-layout convention.
- Wherever `App` has children in this phase, parent→child state flows through a magnified telescope (`telescope.magnify(new Lens(get, set))`), never through raw callback props.
- `main.tsx` mounts the app wrapped in MUI's `ThemeProvider` using a forced-dark theme (`createTheme({ palette: { mode: "dark" } })`) — dark mode is applied unconditionally, not derived from `prefers-color-scheme` or any OS/browser setting.
- The board-plus-tray area (even if the tray/board contents are still placeholder-level this phase) is wrapped by a `DndContext` ancestor component that only sets up `DndContext` and does not itself call `useDraggable`/`useDroppable`/`useDndMonitor` in the same function body — per `docs/CONVENTIONS.md`'s dnd-kit gotcha, those hooks must run in a real descendant of `<DndContext>`, not in the component that constructs it.
- The app renders a real generated board from Phase 1–3's domain layer (a real `Game`/`Board` produced via the actual board-generation/unfolding logic, not a hand-authored mock or hard-coded fixture) — unstyled/bare-bones rendering (e.g. plain divs or minimal MUI primitives showing cell/piece values as text) is acceptable; a fully styled `BoardDisplay`/`CellDisplay` is explicitly out of scope until Phase 5.
- The top bar renders six elements in this exact left-to-right order: drag-fit-hint icon, Preferences button, New Game button, Undo button, solvability icon, Help button. Placeholder/skeleton/inert versions of these elements are acceptable this phase (no functional behavior required yet), but the order and presence of all six must be verifiable in the rendered DOM.
- A Snackbar and a Dialog exist in the shell as overlay elements (closed/inactive by default is fine this phase) so later phases can wire invalid-move and game-finished behavior into them without restructuring the shell.
- `base/TelescopeComponent.ts` and `base/DndKitInterfaces.ts` are used as-is by the new shell code (imported and exercised by `App.tsx`/`main.tsx`); this phase may adjust either file if a genuine gap blocks the shell (e.g. a missing exported type), but is not expected to author them from scratch since they already exist in this repo, copied verbatim from the original Neighboku source.
- Any new state/types introduced for the shell (e.g. `AppState` and any new component-local state types) are `readonly`/`ReadonlyArray`/`ReadonlyMap`-typed at every level, and any updates to that state are expressed as new objects via spread — never in-place mutation, including for any `Map`s.
- `pnpm build`, `pnpm lint`, and `pnpm test` all succeed with no errors.

## Manual test checklist
- Run `pnpm dev` and open the app in a browser.
- Confirm a real generated board renders (rows/columns of cells with real piece values from the Phase 1–3 domain layer) — unstyled/bare presentation is fine; no `BoardDisplay`/`CellDisplay` polish is expected this phase.
- Confirm the browser devtools console shows no errors or warnings on load.
- Confirm the page renders in dark mode regardless of the OS/browser color-scheme setting — toggle the OS/browser preference to light mode and reload; the app must stay dark.
- Confirm the top bar shows six placeholder/skeleton slots in this left-to-right order: drag-fit-hint icon, Preferences button, New Game button, Undo button, solvability icon, Help button. It is fine if most of them are inert (no click behavior) this phase.
- Confirm the board and piece-tray area are present and visually below the top bar, even if the tray is empty/placeholder this phase.

## Depends on
- Phase 3 merged (which includes board generation from Phase 2 and domain types from Phase 1)
