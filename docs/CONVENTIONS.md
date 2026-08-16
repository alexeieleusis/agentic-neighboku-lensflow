# Conventions for this project

This repo composes two documents that were written independently and, on one point, disagree.
This file is the tie-breaker and the concrete pointer to this repo's own reference
implementations. Read `docs/fractal_component.md` and
`docs/patterns/react/QUICK_REF_PATTERNS.md` first; this file only resolves how they combine
*here*.

## The outer pattern: fractal components (mandatory, unchanged)

Every stateful UI component is `state,telescope → useXViewModel → RenderX`
(`docs/fractal_component.md`, base types in `src/base/TelescopeComponent.ts`). Parent→child
state flow goes through a **magnified telescope**
(`telescope.magnify(new Lens(get, set))`), not raw callback props. This is unchanged and
non-negotiable — see `docs/neighboku-ai-rebuild/requirements.md` §7.2.

## File layout: the harness convention supersedes `fractal_component.md`'s single file

`fractal_component.md` (and the original Neighboku codebase) bundle a component's props type,
view-model type, and `useXViewModel` hook into one `ComponentName.entities.ts` file. **This repo
does not use that layout.** Per `requirements.md` §7.4, the file layout is instead:

- `ComponentName.tsx` — the component function and its `RenderComponentName` render function.
- `ComponentName.types.ts` — props type + view-model type only. No hook logic.
- One or more `useComponentName*.ts` hook files — see the scale rule below.

## Scale rule: when to split `useXViewModel`

A **trivial** component (a simple leaf with no real state/action complexity — see this repo's
`src/components/CounterDisplay/`) keeps one flat `useComponentNameViewModel.ts`.

A **non-trivial** component (real local state, user actions, or business rules — see this
repo's `src/components/FaceSwatchBoard/`) splits `useXViewModel` into:

- `useComponentNameDomain.ts` — pure functions only. No React, no telescope imports. The
  component-local business rules and derived-value calculations.
- `useComponentNameState.ts` — local, non-telescope UI state (`useState`/`useMemo`) plus values
  derived from the magnified telescope's current state via the domain functions. Returns an
  internal shape including setters; the orchestrator strips setters before the public view model
  is returned.
- `useComponentNameActions.ts` — event-handler closures only, one per user interaction. Each
  action curries a domain function with current state/telescope, then commits via
  `telescope.update`/`.evolve`. No business logic directly in an action body.
- `useComponentNameViewModel.ts` — the orchestrator. Composes the three above. Wiring only.

This is a scale rule, not a mandate to fragment every component — see
`requirements.md` §7.2.1 for the full rationale, and the harness's own
`docs/patterns/react/QUICK_REF_PATTERNS.md` for the general (non-telescope) version of the same
idea. The two differ only in what the "actions" tier does with the result: the harness's generic
convention calls a mutation/API function; here, an action's only valid "commit" step is a
telescope write.

## dnd-kit: DndContext must be an ancestor, not set up inline in the same component

`useDraggable`, `useDroppable`, and `useDndMonitor` all register themselves via React
context. That context only exists **inside** `<DndContext>`'s subtree. Concretely: a
component's own function body runs *before* the JSX it returns is mounted, so if that same
function both calls a hook that needs the context **and** constructs the `<DndContext>`
element it returns, the hook call happens too early — it's part of `<DndContext>`'s
*parent's* render, not a descendant's. The registration silently no-ops: no error, no
crash, just a droppable/monitor that never receives any drag events.

```tsx
// ❌ Broken: useDroppable (inside useXViewModel) runs before <DndContext> exists.
function MyBoard(props) {
  const viewModel = useMyBoardViewModel(props); // calls useDroppable internally
  return <DndContext onDragEnd={viewModel.onDragEnd}>{/* ... */}</DndContext>;
}

// ✅ Correct: split into an outer component that only sets up DndContext, and an
// inner component — a real descendant — that does the view-model work.
function MyBoard(props) {
  return (
    <DndContext>
      <MyBoardConnected {...props} />
    </DndContext>
  );
}
function MyBoardConnected(props) {
  const viewModel = useMyBoardViewModel(props); // now correctly inside DndContext
  useDndMonitor({ onDragEnd: viewModel.onDragEnd });
  return RenderMyBoard(viewModel);
}
```

This is exactly the bug `FaceSwatchBoard` shipped with initially (see its `git`/session
history if available) — drag-start worked (`DraggableFaceTile`'s `useDraggable` genuinely
was a `DndContext` descendant), but the drop slot's `useDroppable` never registered, so
`onDragEnd`'s `event.over` was always `null` no matter the target size or DOM element used.
If a future phase adds a droppable/draggable and drops stop registering with `over` always
`null`, check this first before suspecting collision-detection geometry.

## Storybook: catalog, not automated tests

Per `docs/patterns/react/QUICK_REF_PATTERNS.md`, Storybook stories are a **manual verification
catalog**, not an automated test suite — no `play` functions, no assertions in `.stories.tsx`
files. Automated coverage lives in `__tests__/*.test.ts(x)` (Vitest). In the telescope world,
a story doesn't need the harness convention's `createMockProps()` helper — the telescope *is*
the props, so a story just constructs a standalone `Telescope.of(initialState)` and passes
`{ state, telescope }` directly. See `src/components/CounterDisplay/CounterDisplay.stories.tsx`
and `src/components/FaceSwatchBoard/FaceSwatchBoard.stories.tsx`.

## Testing pyramid (additive, per requirements.md §7.5)

Domain-function tests are highest priority (pure, fast, no rendering) — see
`src/components/FaceSwatchBoard/__tests__/useFaceSwatchBoardDomain.test.ts` for the concrete,
runnable example this repo ships. Then hook tests, then a view-model integration test, then
component tests where conditional rendering is non-trivial. Real-browser interaction/screenshot
tests are out of scope for this template (see `requirements.md` §7.5's own framing — they're
"genuine case" additions for later phases, e.g. actual `@dnd-kit` drag interactions and the
Faces-mode image grid, not something this scaffold needs to stand up).

## Dependency-freshness notes (this repo runs newer majors than the original)

Per the user's explicit call during scaffolding, this repo runs **current-latest** dependency
majors rather than the original Neighboku's ~2-year-old pins (`requirements.md` §7.1 lists the
original majors; treat them as historical context, not the actual installed versions — check
`package.json` for what's really here). One functional difference worth flagging up front:

- **MUI is on v9, not v6.** `Stack`'s system shorthand props (`alignItems`, `justifyContent`,
  etc.) were removed in a later MUI major — only `direction`, `spacing`, `divider`,
  `useFlexGap`, and `sx` remain on `StackOwnProps`. Use `sx={{ alignItems: "center" }}` instead
  of an `alignItems` prop directly (see `CounterDisplay.tsx` for a working example). Expect
  similar shorthand-prop removals on other layout primitives (`Grid`, `Box`) if you hit a type
  error that looks like a missing prop MUI v6 docs say should exist — check the installed
  version's actual `.d.ts` under `node_modules/@mui/material/<Component>/` rather than trusting
  older MUI documentation/muscle memory.

- **`eslint-plugin-react-hooks` is pinned to `^5.2.0`, not the current latest major (7.x).**
  v7's `recommended` config replaces the classic `rules-of-hooks`/`exhaustive-deps` pair with a
  much larger React-Compiler-oriented ruleset (`purity`, `immutability`, `refs`,
  `set-state-in-render`, `error-boundaries`, `gating`, etc.) — this project does not opt into
  the React Compiler, and v7's `refs` rule flags the standard, correct
  `ref={draggable.setNodeRef}` callback-ref pattern (used throughout dnd-kit, and in the
  original Neighboku's own `CellDisplay`) as an error. This is a real compatibility conflict,
  not a bug in this repo's code — see `src/components/FaceSwatchBoard/DraggableFaceTile.tsx`
  for a legitimate, correct use of the pattern. Per this repo's own "latest, unless it actually
  conflicts" policy, only this one package is held back; re-evaluate the pin once v7 (or later)
  correctly recognizes external hooks that return callback-ref setters.
- `@vitejs/plugin-react-swc` prints an informational (non-blocking) warning under Vite 8's
  rolldown-based dev/build pipeline suggesting the plain `@vitejs/plugin-react` instead, since
  Vite 8 no longer needs a separate SWC transform for most cases. Kept as-is: it's explicitly
  named in `requirements.md` §7.1, the warning doesn't fail `pnpm build`/`pnpm lint`/`pnpm test`,
  and switching isn't worth diverging from the pinned convention over a perf-only suggestion.

## Updating eslint-plugin-lensflow

`eslint-plugin-lensflow` (the LensFlow ESLint rules — see
`docs/neighboku-ai-rebuild/00-overview.md`) is consumed as an unpublished git dependency, not from
npm: `"eslint-plugin-lensflow": "github:alexeieleusis/lens-flow#path:/eslint-lensflow-plugin"` in
`package.json`, tracking the sibling `lens-flow` repo's `main` branch. Rules run at `"warn"` via
`eslint.lensflow.config.js` / `pnpm lint:lensflow`, separate from the main `pnpm lint`.

**Syntax when pinning to a specific commit**: to combine a commit-ish with the `path:` subdirectory
fragment, join them with `&`, not a second `#`:
`github:alexeieleusis/lens-flow#<sha>&path:/eslint-lensflow-plugin`. A second `#` (e.g.
`#<sha>#path:/eslint-lensflow-plugin`) is silently mis-parsed — pnpm treats everything after the
*first* `#` (including the literal `path:/eslint-lensflow-plugin` suffix) as one committish to
resolve, which of course doesn't exist as a ref, producing:
`[ERROR] Could not resolve <sha>#path:/eslint-lensflow-plugin to a commit of
https://github.com/alexeieleusis/lens-flow.git`. If you hit that error, check for a stray second
`#` in the `package.json` dependency string before assuming the commit itself is missing or
unpushed — verify the commit actually exists on the remote first with
`git ls-remote https://github.com/alexeieleusis/lens-flow.git | grep <sha>` (having it locally in
the sibling `~/development/lens-flow` clone is not sufficient; pnpm resolves against the GitHub
remote, not any local clone) before debugging the dependency string.

pnpm blocks build scripts (the plugin's `prepare` step, which builds `dist/` from source) for git
dependencies by default (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`) unless the exact resolved
commit SHA is listed under `allowBuilds` in `pnpm-workspace.yaml`. Because that key embeds the SHA,
it goes stale every time the dependency is updated.

**To pick up new rule changes from `main`, run `pnpm update:lensflow`** (`scripts/update-lensflow.mjs`).
It reads the latest `origin/main` commit from the sibling `~/development/lens-flow` clone (running
`git fetch origin` there first; override the path with `LENS_FLOW_CLONE_PATH`), rewrites the SHA in
both `package.json` and `pnpm-workspace.yaml`'s `allowBuilds` key, and runs `pnpm install` — including
the tarball-integrity workaround described below. `--dry-run` stops after printing the target SHA and
editing `package.json`/`pnpm-workspace.yaml`, without running `pnpm install`.

The rest of this section documents what the script does and why, for when it needs to be debugged or
reproduced by hand.

**Known failure: `ERR_PNPM_TARBALL_INTEGRITY` on a fresh commit.** Updating to a commit pushed within
roughly the last day can fail like this, repeatably, even across `pnpm store prune` and
`pnpm install --update-checksums`:

```
[ERR_PNPM_TARBALL_INTEGRITY] Got unexpected checksum for "https://codeload.github.com/.../tar.gz/<sha>".
Wanted "sha512-<hash-A>". Got "sha512-<hash-B>".
```

Diagnosed 2026-08-16: this is not tampering or a stale local cache. `pnpm update`/`pnpm install
--update-checksums` can write a `resolution.integrity` into `pnpm-lock.yaml` for the *new* commit that
is byte-identical to the *previous* pinned commit's integrity, instead of the new tarball's real hash
(confirmed by downloading the tarball independently and hashing it — the content itself is stable
across repeated downloads from `codeload.github.com`, so this is pnpm miscomputing/copying the
lockfile field, not the server serving inconsistent content). `--update-checksums` does not correct
this for this `gitHosted` tarball dependency shape; it fails identically on retry. The reliable fix —
what the script does — is to download the tarball independently, compute its real sha512 ourselves,
and write that directly into the `resolution.integrity` field of the matching `pnpm-lock.yaml` entry
before re-running `pnpm install`. Separately, if the tarball for the target commit is already in the
local pnpm store from a prior attempt, `pnpm install` can resolve the entry with **no** `integrity`
field at all rather than a stale one — the script checks for and fills in that case too, then re-runs
`pnpm install` to confirm the lockfile it leaves behind is one pnpm has actually validated.

If you ever need to redo this by hand: replace the old SHA in `pnpm-workspace.yaml`'s `allowBuilds`
key with the new one (`pnpm update eslint-plugin-lensflow`'s error reports the resolved SHA even
though the command itself fails), download
`https://codeload.github.com/alexeieleusis/lens-flow/tar.gz/<new-sha>`, hash it
(`openssl dgst -sha512 -binary <file> | base64`), and paste `sha512-<that-hash>` into the
`resolution.integrity` field of the `eslint-plugin-lensflow@https://codeload.../tar.gz/<new-sha>#path:/eslint-lensflow-plugin`
entry in `pnpm-lock.yaml` before running `pnpm install` again. pnpm sometimes leaves a stray leftover
line in `pnpm-workspace.yaml` for the *old* SHA (`<old-key>: set this to true or false`); confirm via
`grep eslint-plugin-lensflow pnpm-lock.yaml` that only the new SHA remains, then delete that line (the
script does this automatically).

## Reference assets already seeded here — no install/config needed to start a phase

- `src/base/TelescopeComponent.ts`, `src/base/DndKitInterfaces.ts` — copied verbatim from the
  original Neighboku source.
- `public/faces/*.png` — the 27 face images (`h{h}e{e}m{m}.png`), copied from the original
  source's `public/faces/`. **License note carried forward from `requirements.md` §5.4/§8**:
  these are Freepik-licensed; once a real Faces-mode UI ships (see the original plan's Phase 19),
  the in-app Help panel must attribute
  https://www.freepik.com/free-vector/young-people-expressions-with-different-faces_1250793.htm
  — re-verify the license terms before shipping publicly, don't assume the original attribution
  text is complete/current.
- `@dnd-kit/core` + `@dnd-kit/utilities` — already installed; see `FaceSwatchBoard` for a
  working `DndContext`/`useDraggable`/`useDroppable` wiring example.
- `telescopejs` + `rxjs` — already installed; see both worked examples for `Telescope.of`,
  `Telescope.magnify`, and `Lens` usage.
- Storybook — already configured (`.storybook/`), with a dark MUI theme decorator so the
  gallery matches the real app's forced-dark-theme requirement (`requirements.md` §5.1).
