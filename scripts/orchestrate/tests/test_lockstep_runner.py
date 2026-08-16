from pathlib import Path

import pytest

from orchestrate import lockstep_runner
from orchestrate.config import TrackConfig
from orchestrate.errors import RetryBudgetExhausted
from orchestrate.models import PhaseMetrics
from orchestrate.phase_runner import PhaseRunResult


def _write_phase_file(phases_dir: Path, number: int, name: str) -> Path:
    phases_dir.mkdir(parents=True, exist_ok=True)
    content = f"""# Phase {number} — {name}

## Scope (files this phase may create/modify)
- game/{name}.ts

## Requirements
See requirements.md.

## Acceptance criteria
- Something works.

## Manual test checklist
- N/A (unit-test only)

## Depends on
- Phase {number - 1} merged.
"""
    path = phases_dir / f"{number:02d}-{name}.md"
    path.write_text(content, encoding="utf-8")
    return path


def _track(tmp_path: Path, name: str) -> TrackConfig:
    review_clone = tmp_path / name / "review"
    review_clone.mkdir(parents=True)
    return TrackConfig(
        track=name,
        repo_slug=f"acme/neighboku-ai-{name}",
        impl_clone=tmp_path / name / "impl",
        review_clone=review_clone,
        harness_config=tmp_path / name / ".harness.toml",
        vibe_heal_env_file=tmp_path / name / ".env.vibeheal",
    )


def _seed_identical_phase_files(baseline: TrackConfig, lensflow: TrackConfig, phases: list[tuple[int, str]]) -> None:
    for number, name in phases:
        _write_phase_file(baseline.phases_dir, number, name)
        _write_phase_file(lensflow.phases_dir, number, name)


def test_alternates_baseline_then_lensflow_per_phase(tmp_path: Path, mocker) -> None:
    baseline = _track(tmp_path, "baseline")
    lensflow = _track(tmp_path, "lensflow")
    _seed_identical_phase_files(baseline, lensflow, [(1, "one"), (2, "two")])
    mocker.patch(
        "orchestrate.lockstep_runner.already_merged_phase_numbers", return_value=set()
    )
    order = []

    def fake_run_phase(track, phase, **kwargs):
        order.append((track.track, phase.number))
        return PhaseRunResult(
            metrics=PhaseMetrics(track=track.track, phase_number=phase.number, phase_name=phase.name),
            merged=True,
        )

    mocker.patch("orchestrate.lockstep_runner._run_phase", side_effect=fake_run_phase)

    lockstep_runner.run_lockstep(baseline, lensflow)

    assert order == [
        ("baseline", 1),
        ("lensflow", 1),
        ("baseline", 2),
        ("lensflow", 2),
    ]


def test_halts_both_tracks_when_baseline_escalates(tmp_path: Path, mocker) -> None:
    baseline = _track(tmp_path, "baseline")
    lensflow = _track(tmp_path, "lensflow")
    _seed_identical_phase_files(baseline, lensflow, [(1, "one"), (2, "two")])
    mocker.patch(
        "orchestrate.lockstep_runner.already_merged_phase_numbers", return_value=set()
    )
    order = []

    def fake_run_phase(track, phase, **kwargs):
        order.append((track.track, phase.number))
        if track.track == "baseline" and phase.number == 1:
            raise RetryBudgetExhausted(3, "https://x.invalid/pull/1", 2)
        return PhaseRunResult(
            metrics=PhaseMetrics(track=track.track, phase_number=phase.number, phase_name=phase.name),
            merged=True,
        )

    mocker.patch("orchestrate.lockstep_runner._run_phase", side_effect=fake_run_phase)

    with pytest.raises(RetryBudgetExhausted) as excinfo:
        lockstep_runner.run_lockstep(baseline, lensflow)

    # lensflow's phase 1 is never attempted, and phase 2 never starts on either
    assert order == [("baseline", 1)]
    assert excinfo.value.track == "baseline"
    assert excinfo.value.phase_number == 1


def test_halts_when_lensflow_escalates_after_baseline_succeeds(tmp_path: Path, mocker) -> None:
    baseline = _track(tmp_path, "baseline")
    lensflow = _track(tmp_path, "lensflow")
    _seed_identical_phase_files(baseline, lensflow, [(1, "one"), (2, "two")])
    mocker.patch(
        "orchestrate.lockstep_runner.already_merged_phase_numbers", return_value=set()
    )
    order = []

    def fake_run_phase(track, phase, **kwargs):
        order.append((track.track, phase.number))
        if track.track == "lensflow" and phase.number == 1:
            raise RetryBudgetExhausted(3, "https://x.invalid/pull/1", 2)
        return PhaseRunResult(
            metrics=PhaseMetrics(track=track.track, phase_number=phase.number, phase_name=phase.name),
            merged=True,
        )

    mocker.patch("orchestrate.lockstep_runner._run_phase", side_effect=fake_run_phase)

    with pytest.raises(RetryBudgetExhausted):
        lockstep_runner.run_lockstep(baseline, lensflow)

    # baseline's phase 1 DID complete (it's fine — nothing to undo), but
    # phase 2 never starts on either track
    assert order == [("baseline", 1), ("lensflow", 1)]


def test_missing_phase_file_on_one_track_raises_hygiene_error(tmp_path: Path, mocker) -> None:
    baseline = _track(tmp_path, "baseline")
    lensflow = _track(tmp_path, "lensflow")
    _write_phase_file(baseline.phases_dir, 1, "one")
    lensflow.phases_dir.mkdir(parents=True, exist_ok=True)  # empty — no copy
    mocker.patch(
        "orchestrate.lockstep_runner.already_merged_phase_numbers", return_value=set()
    )
    mocker.patch(
        "orchestrate.lockstep_runner._run_phase",
        side_effect=lambda track, phase, **kwargs: PhaseRunResult(
            metrics=PhaseMetrics(
                track=track.track, phase_number=phase.number, phase_name=phase.name
            ),
            merged=True,
        ),
    )

    with pytest.raises(RuntimeError, match="comparison hygiene"):
        lockstep_runner.run_lockstep(baseline, lensflow)


def test_skips_phases_already_merged_independently_per_track(tmp_path: Path, mocker) -> None:
    baseline = _track(tmp_path, "baseline")
    lensflow = _track(tmp_path, "lensflow")
    _seed_identical_phase_files(baseline, lensflow, [(1, "one")])

    def merged(track):
        return {1} if track.track == "baseline" else set()

    mocker.patch(
        "orchestrate.lockstep_runner.already_merged_phase_numbers", side_effect=merged
    )
    order = []

    def fake_run_phase(track, phase, **kwargs):
        order.append((track.track, phase.number))
        return PhaseRunResult(
            metrics=PhaseMetrics(track=track.track, phase_number=phase.number, phase_name=phase.name),
            merged=True,
        )

    mocker.patch("orchestrate.lockstep_runner._run_phase", side_effect=fake_run_phase)

    lockstep_runner.run_lockstep(baseline, lensflow)

    assert order == [("lensflow", 1)]  # baseline's phase 1 was already merged
