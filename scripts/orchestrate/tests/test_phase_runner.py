from pathlib import Path

import pytest

from orchestrate import phase_runner
from orchestrate.config import TrackConfig
from orchestrate.errors import (
    EmptyImplementationError,
    ManualTestFailed,
    MergeGateFailure,
    RetryBudgetExhausted,
    ScopeViolation,
)
from orchestrate.models import PhaseSpec


def _track(tmp_path: Path, **overrides) -> TrackConfig:
    base = dict(
        track="baseline",
        repo_slug="acme/neighboku-ai-baseline",
        impl_clone=tmp_path / "impl",
        review_clone=tmp_path / "review",
        harness_config=tmp_path / ".harness.toml",
        vibe_heal_env_file=tmp_path / ".env.vibeheal",
        max_cycles=3,
    )
    base.update(overrides)
    return TrackConfig(**base)


def _phase(**overrides) -> PhaseSpec:
    base = dict(
        number=1,
        name="domain-core",
        scope_globs=["game/entities.ts"],
        requirements_excerpt="See requirements.md §3.1.",
        acceptance_criteria=["Neighbor rule matches exactly one attribute."],
        manual_test_checklist=[],
        depends_on=[],
        source_path=Path("/phases/01-domain-core.md"),
    )
    base.update(overrides)
    return PhaseSpec(**base)


def _base_toolchain(**overrides) -> phase_runner.Toolchain:
    """A toolchain wired for the fully-clean happy path: one commit, zero
    unresolved threads, manual test passes first try. Individual tests
    override specific callables to force each escalation category."""
    defaults = dict(
        checkout_fresh_branch=lambda clone, branch, base: None,
        opencode_run=lambda clone, prompt: "did stuff",
        commit_all=lambda clone, message: True,
        scope_check=lambda clone, globs, base: None,
        push_branch=lambda clone, branch: None,
        fetch_resync=lambda clone, branch: None,
        pr_create=lambda clone, branch, title, body, base: None,
        pr_view=lambda clone: {"number": 7, "url": "https://x.invalid/pull/7"},
        vibe_heal_scan=lambda clone, **kwargs: {"files": []},
        vibe_heal_post=lambda clone, **kwargs: None,
        harness_self_review=lambda clone, config: "ok",
        harness_address_comments=lambda clone, config: "ok",
        unresolved_thread_count=lambda clone, owner, repo, pr: 0,
        manual_test_prompt=lambda number, name, checklist: True,
        merge_gates_run=lambda clone: None,
        pr_merge=lambda clone, pr: None,
        diff_stat=lambda clone, base: (2, 10, 1),
        metrics_append_and_commit=lambda clone, log_json, log_md, m, base_branch: None,
    )
    defaults.update(overrides)
    return phase_runner.Toolchain(**defaults)


def test_happy_path_merges_and_returns_metrics(tmp_path: Path) -> None:
    track = _track(tmp_path)
    phase = _phase()
    tools = _base_toolchain()

    result = phase_runner.run_phase(track, phase, toolchain=tools)

    assert result.merged is True
    assert result.metrics.pr_number == 7
    assert result.metrics.address_comments_cycles == 1
    assert result.metrics.manual_test_first_try_pass is True
    assert result.metrics.pr_diff_files == 2
    assert result.metrics.human_escalations == 0
    assert result.metrics.pr_merged_at is not None


def test_empty_implementation_raises_and_records_escalation(tmp_path: Path) -> None:
    track = _track(tmp_path)
    phase = _phase()
    escalations = []
    tools = _base_toolchain(
        commit_all=lambda clone, message: False,
        metrics_append_and_commit=lambda clone, log_json, log_md, m, base_branch: escalations.append(m),
    )

    with pytest.raises(EmptyImplementationError):
        phase_runner.run_phase(track, phase, toolchain=tools)

    assert len(escalations) == 1
    assert escalations[0].human_escalations == 1
    assert "no changes" in escalations[0].escalation_reason


def test_retry_budget_exhausted_when_threads_never_clear(tmp_path: Path) -> None:
    track = _track(tmp_path, max_cycles=2)
    phase = _phase()
    tools = _base_toolchain(unresolved_thread_count=lambda clone, owner, repo, pr: 3)

    with pytest.raises(RetryBudgetExhausted) as excinfo:
        phase_runner.run_phase(track, phase, toolchain=tools)

    assert excinfo.value.cycles == 2


def test_thread_count_clears_on_second_cycle(tmp_path: Path) -> None:
    track = _track(tmp_path, max_cycles=3)
    phase = _phase()
    calls = {"n": 0}

    def unresolved(clone, owner, repo, pr):
        calls["n"] += 1
        return 1 if calls["n"] == 1 else 0

    tools = _base_toolchain(unresolved_thread_count=unresolved)

    result = phase_runner.run_phase(track, phase, toolchain=tools)

    assert result.merged is True
    assert result.metrics.address_comments_cycles == 2


def test_manual_test_retry_consumes_a_cycle_then_succeeds(tmp_path: Path) -> None:
    track = _track(tmp_path, max_cycles=3)
    phase = _phase(manual_test_checklist=["Board renders"])
    calls = {"n": 0}

    def manual_prompt(number, name, checklist):
        calls["n"] += 1
        return calls["n"] > 1  # fails first attempt, opts into retry, passes second

    tools = _base_toolchain(manual_test_prompt=manual_prompt)

    result = phase_runner.run_phase(track, phase, toolchain=tools)

    assert result.merged is True
    # "first try" reflects the very first manual-test attempt, which failed
    assert result.metrics.manual_test_first_try_pass is False
    assert result.metrics.address_comments_cycles == 2


def test_manual_test_failure_with_no_retry_escalates(tmp_path: Path) -> None:
    track = _track(tmp_path)
    phase = _phase(manual_test_checklist=["Board renders"])
    metrics_logs = []

    def manual_prompt(number, name, checklist):
        raise ManualTestFailed("board did not render")

    tools = _base_toolchain(
        manual_test_prompt=manual_prompt,
        metrics_append_and_commit=lambda clone, log_json, log_md, m, base_branch: metrics_logs.append(m),
    )

    with pytest.raises(ManualTestFailed):
        phase_runner.run_phase(track, phase, toolchain=tools)

    assert len(metrics_logs) == 1
    assert metrics_logs[0].human_escalations == 1
    assert "board did not render" in metrics_logs[0].escalation_reason


def test_vibe_heal_dedup_only_posts_when_new_fingerprints_appear(tmp_path: Path) -> None:
    track = _track(tmp_path, max_cycles=3)
    phase = _phase()
    scan_reports = [
        {"files": [{"file_path": "a.ts", "issues": [{"rule": "S1", "line": 1, "on_changed_line": True}]}]},
        {"files": [{"file_path": "a.ts", "issues": [{"rule": "S1", "line": 1, "on_changed_line": True}]}]},
    ]
    unresolved_sequence = [1, 0]
    post_calls = []

    def scan(clone, **kwargs):
        return scan_reports.pop(0)

    def unresolved(clone, owner, repo, pr):
        return unresolved_sequence.pop(0)

    tools = _base_toolchain(
        vibe_heal_scan=scan,
        vibe_heal_post=lambda clone, **kwargs: post_calls.append(kwargs),
        unresolved_thread_count=unresolved,
    )

    result = phase_runner.run_phase(track, phase, toolchain=tools)

    assert result.merged is True
    # same fingerprint set both cycles -> only the first scan's post fires
    assert len(post_calls) == 1
    # cycle 1 introduces 1 new fingerprint; cycle 2 sees the same set
    assert result.metrics.sonar_issues_opened == 1
    assert result.metrics.sonar_issues_resolved == 0
    assert result.metrics.sonar_issues_left_open == 1


def test_auto_merge_false_skips_merge_but_runs_gates(tmp_path: Path) -> None:
    track = _track(tmp_path)
    phase = _phase()
    merge_calls = []
    gate_calls = []
    tools = _base_toolchain(
        pr_merge=lambda clone, pr: merge_calls.append(pr),
        merge_gates_run=lambda clone: gate_calls.append(clone),
    )

    result = phase_runner.run_phase(track, phase, toolchain=tools, auto_merge=False)

    assert result.merged is False
    assert merge_calls == []
    assert len(gate_calls) == 1
    assert result.metrics.pr_merged_at is None


def test_dry_run_toolchain_completes_without_live_tools(tmp_path: Path) -> None:
    track = _track(tmp_path)
    phase = _phase()

    result = phase_runner.run_phase(track, phase, dry_run=True)

    assert result.merged is True
    assert result.metrics.pr_number == 1


def test_resume_skips_implement_and_reuses_existing_pr(tmp_path: Path) -> None:
    track = _track(tmp_path)
    phase = _phase()
    state_dir = tmp_path / "state"
    calls = {"pr_create": 0, "checkout": 0}

    def pr_create(clone, branch, title, body, base):
        calls["pr_create"] += 1

    def checkout(clone, branch, base):
        calls["checkout"] += 1

    tools = _base_toolchain(pr_create=pr_create, checkout_fresh_branch=checkout)

    # First run: opens the PR and persists resume state.
    phase_runner.run_phase(
        track, phase, toolchain=tools, auto_merge=False, resume=True, state_dir=state_dir
    )
    assert calls == {"pr_create": 1, "checkout": 1}
    state_path = phase_runner.resume_state_path(state_dir, track, phase)
    assert state_path.exists()

    # Second run with resume=True: must not re-implement or re-open a PR.
    result = phase_runner.run_phase(
        track, phase, toolchain=tools, resume=True, state_dir=state_dir
    )

    assert calls == {"pr_create": 1, "checkout": 1}  # unchanged
    assert result.merged is True
    assert result.metrics.pr_number == 7
    assert not state_path.exists()  # cleaned up once fully merged


def test_state_file_is_keyed_by_repo_and_branch_not_branch_alone(tmp_path: Path) -> None:
    phase = _phase()
    state_dir = tmp_path / "state"
    baseline = _track(tmp_path, track="baseline", repo_slug="acme/neighboku-ai-baseline")
    lensflow = _track(tmp_path, track="lensflow", repo_slug="acme/neighboku-ai-lensflow")

    assert phase_runner.resume_state_path(
        state_dir, baseline, phase
    ) != phase_runner.resume_state_path(state_dir, lensflow, phase)


def test_scope_violation_raises_and_records_escalation(tmp_path: Path) -> None:
    track = _track(tmp_path)
    phase = _phase()
    metrics_logs = []

    def scope_fail(clone, globs, base):
        raise ScopeViolation(["out.ts"], globs)

    tools = _base_toolchain(
        scope_check=scope_fail,
        metrics_append_and_commit=lambda clone, log_json, log_md, m, base_branch: metrics_logs.append(m),
    )

    with pytest.raises(ScopeViolation) as excinfo:
        phase_runner.run_phase(track, phase, toolchain=tools)

    assert "out.ts" in str(excinfo.value)
    assert len(metrics_logs) == 1
    assert metrics_logs[0].human_escalations == 1
    assert "outside declared scope" in metrics_logs[0].escalation_reason


def test_merge_gate_failure_raises_and_records_escalation(tmp_path: Path) -> None:
    track = _track(tmp_path)
    phase = _phase()
    metrics_logs = []

    def gate_fail(clone):
        raise MergeGateFailure("lint", "error: bad")

    tools = _base_toolchain(
        merge_gates_run=gate_fail,
        metrics_append_and_commit=lambda clone, log_json, log_md, m, base_branch: metrics_logs.append(m),
    )

    with pytest.raises(MergeGateFailure) as excinfo:
        phase_runner.run_phase(track, phase, toolchain=tools)

    assert excinfo.value.gate_name == "lint"
    assert len(metrics_logs) == 1
    assert metrics_logs[0].human_escalations == 1
    assert "merge gate" in metrics_logs[0].escalation_reason


def test_live_toolchain_checks_repo_identity_around_opencode_run(tmp_path: Path, mocker) -> None:
    track = _track(tmp_path)
    phase = _phase()
    guard = mocker.patch("orchestrate.phase_runner.repo_guard.assert_repo_identity")
    mocker.patch("orchestrate.phase_runner._live_toolchain", return_value=_base_toolchain())

    phase_runner.run_phase(track, phase)

    assert guard.call_count == 2
    for call in guard.call_args_list:
        assert call.args == (track.impl_clone, track.repo_slug)


def test_dry_run_skips_repo_identity_check(tmp_path: Path, mocker) -> None:
    track = _track(tmp_path)
    phase = _phase()
    guard = mocker.patch("orchestrate.phase_runner.repo_guard.assert_repo_identity")

    phase_runner.run_phase(track, phase, dry_run=True)

    guard.assert_not_called()


def test_explicit_toolchain_skips_repo_identity_check(tmp_path: Path, mocker) -> None:
    track = _track(tmp_path)
    phase = _phase()
    guard = mocker.patch("orchestrate.phase_runner.repo_guard.assert_repo_identity")
    tools = _base_toolchain()

    phase_runner.run_phase(track, phase, toolchain=tools)

    guard.assert_not_called()
