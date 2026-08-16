from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from orchestrate import gh_ops, git_ops, harness_runner, manual_test, merge_gates, metrics
from orchestrate import opencode_runner, repo_guard, scope_guard, vibe_heal_runner
from orchestrate.config import TrackConfig
from orchestrate.errors import (
    EmptyImplementationError,
    OrchestrationError,
    RetryBudgetExhausted,
)
from orchestrate.models import PhaseMetrics, PhaseSpec, ResumeState, RetryCycleState


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _render_prompt(phase: PhaseSpec) -> str:
    scope = "\n".join(f"- {g}" for g in phase.scope_globs)
    criteria = "\n".join(f"- {c}" for c in phase.acceptance_criteria)
    return (
        f"# Phase {phase.number}: {phase.name}\n\n"
        f"## Requirements\n{phase.requirements_excerpt}\n\n"
        f"## Acceptance criteria\n{criteria}\n\n"
        f"## Scope — only create or modify these files\n{scope}\n"
    )


@dataclass
class Toolchain:
    """Every external-tool call the 8-step workflow makes, as swappable
    callables — the seam --dry-run (and unit tests) inject stubs through,
    instead of mocking subprocess calls scattered across five modules."""

    checkout_fresh_branch: Callable[[Path, str, str], None]
    opencode_run: Callable[[Path, str], str]
    commit_all: Callable[[Path, str], bool]
    scope_check: Callable[[Path, list[str], str], None]
    push_branch: Callable[[Path, str], None]
    fetch_resync: Callable[[Path, str], None]
    pr_create: Callable[[Path, str, str, str, str], None]
    pr_view: Callable[[Path], dict[str, Any]]
    vibe_heal_scan: Callable[..., dict[str, Any]]
    vibe_heal_post: Callable[..., None]
    harness_self_review: Callable[[Path, Path], str]
    harness_address_comments: Callable[[Path, Path], str]
    unresolved_thread_count: Callable[[Path, str, str, int], int]
    manual_test_prompt: Callable[[int, str, list[str]], bool]
    merge_gates_run: Callable[[Path], None]
    pr_merge: Callable[[Path, int], None]
    diff_stat: Callable[[Path, str], tuple[int, int, int]]
    metrics_append_and_commit: Callable[[Path, Path, Path, PhaseMetrics, str], None]


def _live_toolchain() -> Toolchain:
    return Toolchain(
        checkout_fresh_branch=git_ops.checkout_fresh_branch,
        opencode_run=opencode_runner.run,
        commit_all=git_ops.commit_all,
        scope_check=lambda clone, globs, base: scope_guard.check(
            clone, globs, base_ref=base
        ),
        push_branch=git_ops.push_branch,
        fetch_resync=git_ops.fetch_resync,
        pr_create=gh_ops.pr_create,
        pr_view=gh_ops.pr_view,
        vibe_heal_scan=vibe_heal_runner.scan,
        vibe_heal_post=vibe_heal_runner.post,
        harness_self_review=harness_runner.self_review,
        harness_address_comments=harness_runner.address_comments,
        unresolved_thread_count=gh_ops.unresolved_thread_count,
        manual_test_prompt=manual_test.prompt,
        merge_gates_run=merge_gates.run,
        pr_merge=gh_ops.pr_merge,
        diff_stat=git_ops.diff_stat,
        metrics_append_and_commit=metrics.append_and_commit,
    )


def _dry_run_toolchain() -> Toolchain:
    """Stubs every external call so the branch/commit/scope/retry control
    flow can be exercised against a disposable scratch git repo with no live
    opencode/SonarQube/GitHub dependency — see the plan's Stage A build step."""
    state = {"pr_number": 1, "commits": 0}

    def _commit_all(clone: Path, message: str) -> bool:
        # First call per branch is the "opencode implemented something"
        # commit; subsequent calls (inside the iterate loop) simulate
        # address-comments having nothing further to commit.
        state["commits"] += 1
        return state["commits"] == 1

    return Toolchain(
        checkout_fresh_branch=lambda clone, branch, base: None,
        opencode_run=lambda clone, prompt: "dry-run: opencode made a stub change",
        commit_all=_commit_all,
        scope_check=lambda clone, globs, base: None,
        push_branch=lambda clone, branch: None,
        fetch_resync=lambda clone, branch: None,
        pr_create=lambda clone, branch, title, body, base: None,
        pr_view=lambda clone: {
            "number": state["pr_number"],
            "url": f"https://example.invalid/pull/{state['pr_number']}",
        },
        vibe_heal_scan=lambda clone, **kwargs: {"files": []},
        vibe_heal_post=lambda clone, **kwargs: None,
        harness_self_review=lambda clone, config: "dry-run: self-review no-op",
        harness_address_comments=lambda clone, config: "dry-run: address-comments no-op",
        unresolved_thread_count=lambda clone, owner, repo, pr: 0,
        manual_test_prompt=lambda number, name, checklist: True,
        merge_gates_run=lambda clone: None,
        pr_merge=lambda clone, pr: None,
        diff_stat=lambda clone, base: (0, 0, 0),
        metrics_append_and_commit=lambda clone, log_json, log_md, m, base_branch: None,
    )


@dataclass
class PhaseRunResult:
    metrics: PhaseMetrics
    merged: bool


def resume_state_path(state_dir: Path, track: TrackConfig, phase: PhaseSpec) -> Path:
    """Keyed by repo + branch, not branch alone — the same phase branch name
    is reused across both tracks' repos, so a bare-branch key would collide."""
    return state_dir / f"{track.owner}__{track.repo}__{phase.branch_name}.json"


def _load_resume_state(path: Path) -> ResumeState | None:
    if not path.exists():
        return None
    return ResumeState.model_validate_json(path.read_text(encoding="utf-8"))


def _save_resume_state(path: Path, pr: dict[str, Any], pr_opened_at: datetime) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    state = ResumeState(number=pr["number"], url=pr["url"], pr_opened_at=pr_opened_at)
    path.write_text(state.model_dump_json(), encoding="utf-8")


def run_phase(
    track: TrackConfig,
    phase: PhaseSpec,
    *,
    auto_merge: bool = True,
    dry_run: bool = False,
    toolchain: Toolchain | None = None,
    resume: bool = False,
    state_dir: Path | None = None,
) -> PhaseRunResult:
    """The 8-step workflow (implementation-plan.md §2) for one phase on one
    track. Raises an OrchestrationError subclass on any escalation; nothing
    merges and nothing advances to the next phase when that happens. On
    escalation, whatever was learned before the failure is best-effort
    recorded to the metrics log before re-raising.

    `resume`/`state_dir`: if a prior run already got as far as opening a PR
    (recorded in a small state file immediately after step 2, so it survives
    a crash mid-run), `resume=True` skips steps 1-2 entirely and picks back
    up at the iterate loop with the existing PR — rather than re-implementing
    from scratch or, worse, opening a second PR for the same phase.
    """
    using_live_toolchain = toolchain is None and not dry_run
    tools = toolchain or (_dry_run_toolchain() if dry_run else _live_toolchain())
    cycle = RetryCycleState()
    result_metrics = PhaseMetrics(
        track=track.track, phase_number=phase.number, phase_name=phase.name
    )
    state_path = resume_state_path(state_dir, track, phase) if state_dir else None

    try:
        resumed = None
        if resume and state_path is not None:
            resumed = _load_resume_state(state_path)

        if resumed is not None:
            pr = {"number": resumed.number, "url": resumed.url}
            result_metrics.pr_number = pr["number"]
            result_metrics.pr_url = pr["url"]
            result_metrics.pr_opened_at = resumed.pr_opened_at
        else:
            # --- Step 1: implement -------------------------------------------
            tools.checkout_fresh_branch(track.impl_clone, phase.branch_name, track.base_branch)
            if using_live_toolchain:
                repo_guard.assert_repo_identity(track.impl_clone, track.repo_slug)
            tools.opencode_run(track.impl_clone, _render_prompt(phase))
            if using_live_toolchain:
                repo_guard.assert_repo_identity(track.impl_clone, track.repo_slug)
            committed = tools.commit_all(track.impl_clone, f"Implement {phase.pr_title}")
            if not committed:
                raise EmptyImplementationError(
                    f"opencode made no changes for {phase.pr_title}"
                )
            tools.scope_check(track.impl_clone, phase.scope_globs, track.base_branch)

            # --- Step 2: push + PR --------------------------------------------
            tools.push_branch(track.impl_clone, phase.branch_name)
            tools.fetch_resync(track.review_clone, phase.branch_name)
            tools.pr_create(
                track.review_clone,
                phase.branch_name,
                phase.pr_title,
                phase.pr_body,
                track.base_branch,
            )
            pr = tools.pr_view(track.review_clone)
            result_metrics.pr_number = pr["number"]
            result_metrics.pr_url = pr["url"]
            result_metrics.pr_opened_at = _now()
            if state_path is not None:
                _save_resume_state(state_path, pr, result_metrics.pr_opened_at)

        # --- Steps 3-6 (iterate) + step 7 (manual test), sharing one budget -
        # One resync/scope-check up front covers both entry paths: for a
        # fresh PR it's a no-op re-check of what step 2 just fetched; for a
        # resumed PR (no prior step in this run touched review_clone) it's
        # the only thing that syncs it before the loop reads from it.
        tools.fetch_resync(track.review_clone, phase.branch_name)
        tools.scope_check(track.review_clone, phase.scope_globs, track.base_branch)

        report_dir = track.review_clone / ".orchestrate-reports" / phase.branch_name
        report_dir.mkdir(parents=True, exist_ok=True)
        cycle_index = 0
        while True:
            cycle_index += 1
            if cycle_index > track.max_cycles:
                raise RetryBudgetExhausted(
                    track.max_cycles, pr["url"], cycle.unresolved_thread_count or 0
                )
            cycle.cycle_index = cycle_index

            report_file = report_dir / f"cycle-{cycle_index}.json"
            report = tools.vibe_heal_scan(
                track.review_clone,
                report_file=report_file,
                env_file=track.vibe_heal_env_file,
                pr_number=pr["number"],
                base_branch=track.base_branch,
            )
            current_fingerprints = vibe_heal_runner.fingerprints_from_report(report)
            opened, resolved = vibe_heal_runner.diff_fingerprints(
                cycle.posted_vibe_heal_fingerprints, current_fingerprints
            )
            result_metrics.sonar_issues_opened += opened
            result_metrics.sonar_issues_resolved += resolved
            result_metrics.sonar_issues_left_open = len(current_fingerprints)

            if vibe_heal_runner.should_post(
                current_fingerprints, cycle.posted_vibe_heal_fingerprints
            ):
                tools.vibe_heal_post(
                    track.review_clone,
                    report_file=report_file,
                    env_file=track.vibe_heal_env_file,
                    pr_number=pr["number"],
                )
                cycle.posted_vibe_heal_fingerprints = current_fingerprints

            tools.harness_self_review(track.review_clone, track.harness_config)
            tools.harness_address_comments(track.review_clone, track.harness_config)

            tools.fetch_resync(track.review_clone, phase.branch_name)
            tools.scope_check(track.review_clone, phase.scope_globs, track.base_branch)

            unresolved = tools.unresolved_thread_count(
                track.review_clone, track.owner, track.repo, pr["number"]
            )
            cycle.unresolved_thread_count = unresolved
            result_metrics.address_comments_cycles = cycle_index

            if unresolved > 0:
                continue

            manual_ok = tools.manual_test_prompt(
                phase.number, phase.name, phase.manual_test_checklist
            )
            if result_metrics.manual_test_first_try_pass is None:
                result_metrics.manual_test_first_try_pass = manual_ok
            if manual_ok:
                break

        # --- Step 8: merge ----------------------------------------------------
        files, added, removed = tools.diff_stat(track.review_clone, f"origin/{track.base_branch}")
        result_metrics.pr_diff_files = files
        result_metrics.pr_diff_lines_added = added
        result_metrics.pr_diff_lines_removed = removed

        if not auto_merge:
            tools.merge_gates_run(track.review_clone)
            return PhaseRunResult(metrics=result_metrics, merged=False)

        tools.merge_gates_run(track.review_clone)
        tools.pr_merge(track.review_clone, pr["number"])
        result_metrics.pr_merged_at = _now()
        tools.metrics_append_and_commit(
            track.review_clone,
            track.experiment_log_json,
            track.experiment_log_md,
            result_metrics,
            track.base_branch,
        )
        if state_path is not None:
            state_path.unlink(missing_ok=True)
        return PhaseRunResult(metrics=result_metrics, merged=True)

    except OrchestrationError as error:
        result_metrics.human_escalations += 1
        result_metrics.escalation_reason = error.message
        try:
            tools.metrics_append_and_commit(
                track.review_clone,
                track.experiment_log_json,
                track.experiment_log_md,
                result_metrics,
                track.base_branch,
            )
        except Exception:
            pass  # best-effort — don't let logging failure mask the original error
        raise
