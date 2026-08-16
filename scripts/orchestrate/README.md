# orchestrate

Drives the Neighboku AI-rebuild's per-phase workflow (`docs/neighboku-ai-rebuild/implementation-plan.md`
§2) against `opencode`, `gh`, `vibe-heal`, and dotharness (`harness`): implement → push/PR →
static analysis → code review → address comments → iterate (capped retries) → manual test →
merge.

## Setup

```
uv sync
```

## Commands

- `orchestrate run-phase` — the primitive: run the full 8-step workflow for one phase on one
  track.
- `orchestrate run-track` — loop `docs/phases/*.md` in order for one track, skipping
  already-merged phases, halting on the first escalation.
- `orchestrate run-lockstep` — alternate `run-phase` across both tracks, phase by phase, so
  neither advances past a phase the other hasn't finished (implementation-plan.md §1.3).
- `orchestrate status` — per-track phase-completion table.
- `orchestrate report` — regenerate `docs/experiment-log.md` from `docs/experiment-log.json`.

Run any command with `--help` for its full flag list. `run-phase`/`run-track`/`run-lockstep` all
accept `--dry-run` (stubs every external call — validates branch/commit/scope/retry control flow
only, no live opencode/SonarQube/GitHub dependency) and `--resume` (picks back up from an
already-opened PR instead of re-implementing from scratch).

## Config templates

Each track repo needs its own `.harness.toml` and `.env.vibeheal` — both are per-repo, never
committed (dotharness's own convention: add them to your **global** gitignore, not the repo's).
`templates/` has starting points based on real, working configs already confirmed on this
machine:

- `templates/harness.toml.template` → copy to `<review_clone>/.harness.toml`, fill in the repo
  slug and working directory.
- `templates/env.vibeheal.template` → copy to `<review_clone>/.env.vibeheal`, fill in the
  SonarQube project key and a token.

Pass the filled-in paths to `--harness-config` / `--vibe-heal-env-file`.

## Testing

```
uv run pytest
```
