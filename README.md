# agentic-neighboku-template

Phase 0 scaffold for the [Neighboku AI-rebuild experiment](docs/neighboku-ai-rebuild/00-overview.md):
a Vite + React + TypeScript app pre-loaded with the pinned dependency stack, the fractal-component
base primitives, the file-layout convention, drag-and-drop wiring, and the face-image assets that
the actual rebuild phases will need — so implementing any phase requires no install or config step.

Read [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) first — it resolves how the fractal-component
pattern (`docs/fractal_component.md`) and the file-layout convention
(`docs/patterns/react/`) compose in this project, and points at the two worked examples:

- `src/components/CounterDisplay/` — trivial tier (flat `useXViewModel`, no split).
- `src/components/FaceSwatchBoard/` — non-trivial tier (`Domain`/`State`/`Actions` split,
  `@dnd-kit/core` drag-and-drop, `Telescope.magnify`/`Lens`, a domain test).

Both are cataloged in Storybook (`pnpm storybook`) and wired into the running app (`pnpm dev`).

## Scripts

| Command                             | Does                                               |
| ----------------------------------- | -------------------------------------------------- |
| `pnpm dev`                          | Start the Vite dev server                          |
| `pnpm build`                        | Type-check (`tsc -b`) and build for production     |
| `pnpm lint`                         | ESLint                                             |
| `pnpm test` / `pnpm test run`       | Vitest (watch / single run)                        |
| `pnpm coverage`                     | Vitest with coverage                               |
| `pnpm storybook`                    | Storybook dev server (manual-verification catalog) |
| `pnpm build-storybook`              | Static Storybook build                             |
| `pnpm format` / `pnpm format:check` | Prettier write / check                             |

## What's out of scope here

This repo is scaffolding only — no real Neighboku game/domain code, and no orchestration script
for the phased-implementation harness. See
[`docs/neighboku-ai-rebuild/00-overview.md`](docs/neighboku-ai-rebuild/00-overview.md) and
[`implementation-plan.md`](docs/neighboku-ai-rebuild/implementation-plan.md) for that larger plan.
