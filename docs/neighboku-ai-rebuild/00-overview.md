# Neighboku AI Rebuild — Overview

## What this is

A plan to validate a personal AI-assisted dev toolchain — `opencode` for
implementation, [`dotharness`](~/.harness/README.md) for PR-level orchestration,
[`vibe-heal`](~/development/vibe-heal/README.md) for SonarQube static analysis, and
optionally the [LensFlow](~/development/lens-flow/eslint-lensflow-plugin/) ESLint
plugin (built from the `vibe-types` TypeScript constraint catalog) — by using it to
rebuild **Neighboku** from scratch, incrementally, phase by phase, and comparing the
result with and without LensFlow in the loop.

This directory (`planning/neighboku-ai-rebuild/`) is planning-only: no rebuild repo has
been created yet, and nothing here has been executed. It lives on the `neighboku`
repo's `ai_dev_from_scratch` branch as the design record for that work.

## Documents

- [`requirements.md`](requirements.md) — what the rebuild must do, derived from a full
  read of the current `neighboku` `main` source, the in-app docs, the creator's tutorial
  video, and `backlog.md`. This is a **behavioral replication spec**: code-quality
  improvements are deliberately left out of it (see below).
- [`implementation-plan.md`](implementation-plan.md) — the two-repo experiment design,
  the eight-step per-phase workflow (implement → PR → static analysis → review →
  address comments → manual test → merge → next), the safeguards that keep an
  unattended harness on track, and the ordered list of ~20 small phases.

## Key decisions already made

- **Two new GitHub repos**, not branches of the existing repo:
  `neighboku-ai-baseline` and `neighboku-ai-lensflow`. Keeps SonarQube projects, PR
  history, and the comparison itself clean and independent of the hand-written
  original.
- **Strict replication, improvements emergent.** `requirements.md` specifies observed
  behavior only; whatever code-quality gains show up are a product of the
  SonarQube/LensFlow/code-review loop during each phase, not of the spec itself. This
  is what makes the baseline-vs-LensFlow comparison meaningful — the only intended
  variable between the two tracks is LensFlow's presence.
- **Fractal components, refined with a hook-splitting convention (additive, not a
  replacement).** The original `fractal_component.md` pattern
  (`state,telescope → useXViewModel → RenderX`) remains mandatory as-is. Layered on top,
  `useXViewModel` itself splits into narrower hooks for non-trivial components, and an
  additive (not mandated) testing pyramid applies beyond the strict-replication floor —
  see `requirements.md` §7.2.1 and §7.5 for the specifics, and the source convention at
  `~/.harness/knowledge/patterns/react/` — that directory is what the harness reads
  during actual implementation; this overview only records that it composes with the
  fractal pattern, not the mechanics.

## Immediate next steps (not yet done)

1. Review `requirements.md` §8 (known discrepancies) — several are genuine judgment
   calls (diagonal-neighbor claim, `sound` preference with no implementation, forced
   `dimension: 3` on load) that were deliberately left as flagged-but-unresolved rather
   than decided unilaterally.
2. Confirm the two new repo names/owners before anything is created — repo creation is
   a real, hard-to-fully-reverse action and hasn't been done as part of this planning
   pass.
3. Decide whether to run both tracks in true lockstep (recommended, see
   `implementation-plan.md` §1.3) or validate the full pipeline on one track first.
4. Build the "dedicated implement-feature" script referenced in
   `implementation-plan.md` §2 step 1 and §3 — it doesn't exist yet.
