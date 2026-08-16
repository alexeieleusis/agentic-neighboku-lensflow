import json
from pathlib import Path

import pytest

from orchestrate import track_runner
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


def _track(tmp_path: Path) -> TrackConfig:
    review_clone = tmp_path / "review"
    review_clone.mkdir()
    return TrackConfig(
        track="baseline",
        repo_slug="acme/neighboku-ai-baseline",
        impl_clone=tmp_path / "impl",
        review_clone=review_clone,
        harness_config=tmp_path / ".harness.toml",
        vibe_heal_env_file=tmp_path / ".env.vibeheal",
    )


def test_discover_phase_files_sorted_numerically(tmp_path: Path) -> None:
    phases_dir = tmp_path / "phases"
    _write_phase_file(phases_dir, 10, "ten")
    _write_phase_file(phases_dir, 2, "two")
    _write_phase_file(phases_dir, 1, "one")

    files = track_runner.discover_phase_files(phases_dir)

    assert [f.name for f in files] == ["01-one.md", "02-two.md", "10-ten.md"]


def test_already_merged_phase_numbers_only_counts_merged(tmp_path: Path) -> None:
    track = _track(tmp_path)
    track.experiment_log_json.parent.mkdir(parents=True, exist_ok=True)
    track.experiment_log_json.write_text(
        json.dumps(
            [
                PhaseMetrics(
                    track="baseline",
                    phase_number=1,
                    phase_name="foo",
                    pr_merged_at="2026-08-01T00:00:00+00:00",
                ).model_dump(mode="json"),
                PhaseMetrics(
                    track="baseline", phase_number=2, phase_name="bar"
                ).model_dump(mode="json"),  # escalated, never merged
            ]
        ),
        encoding="utf-8",
    )

    assert track_runner.already_merged_phase_numbers(track) == {1}


def test_run_track_skips_already_merged_phases(tmp_path: Path, mocker) -> None:
    track = _track(tmp_path)
    _write_phase_file(track.phases_dir, 1, "one")
    _write_phase_file(track.phases_dir, 2, "two")
    mocker.patch(
        "orchestrate.track_runner.already_merged_phase_numbers", return_value={1}
    )
    seen_phase_numbers = []

    def fake_run_phase(track_arg, phase, **kwargs):
        seen_phase_numbers.append(phase.number)
        return PhaseRunResult(
            metrics=PhaseMetrics(track="baseline", phase_number=phase.number, phase_name=phase.name),
            merged=True,
        )

    mocker.patch("orchestrate.track_runner._run_phase", side_effect=fake_run_phase)

    results = track_runner.run_track(track)

    assert seen_phase_numbers == [2]
    assert len(results) == 1


def test_run_track_respects_start_and_stop_phase(tmp_path: Path, mocker) -> None:
    track = _track(tmp_path)
    for n, name in [(1, "one"), (2, "two"), (3, "three"), (4, "four")]:
        _write_phase_file(track.phases_dir, n, name)
    mocker.patch("orchestrate.track_runner.already_merged_phase_numbers", return_value=set())
    seen = []

    def fake_run_phase(track_arg, phase, **kwargs):
        seen.append(phase.number)
        return PhaseRunResult(
            metrics=PhaseMetrics(track="baseline", phase_number=phase.number, phase_name=phase.name),
            merged=True,
        )

    mocker.patch("orchestrate.track_runner._run_phase", side_effect=fake_run_phase)

    track_runner.run_track(track, start_phase=2, stop_phase=3)

    assert seen == [2, 3]


def test_run_track_halts_on_first_escalation(tmp_path: Path, mocker) -> None:
    track = _track(tmp_path)
    _write_phase_file(track.phases_dir, 1, "one")
    _write_phase_file(track.phases_dir, 2, "two")
    mocker.patch("orchestrate.track_runner.already_merged_phase_numbers", return_value=set())
    seen = []

    def fake_run_phase(track_arg, phase, **kwargs):
        seen.append(phase.number)
        raise RetryBudgetExhausted(3, "https://x.invalid/pull/1", 2)

    mocker.patch("orchestrate.track_runner._run_phase", side_effect=fake_run_phase)

    with pytest.raises(RetryBudgetExhausted):
        track_runner.run_track(track)

    assert seen == [1]  # phase 2 never attempted


def test_escalation_is_annotated_with_the_in_progress_phase(tmp_path: Path, mocker) -> None:
    track = _track(tmp_path)
    _write_phase_file(track.phases_dir, 1, "one")
    mocker.patch("orchestrate.track_runner.already_merged_phase_numbers", return_value=set())

    def fake_run_phase(track_arg, phase, **kwargs):
        raise RetryBudgetExhausted(3, "https://x.invalid/pull/1", 2)

    mocker.patch("orchestrate.track_runner._run_phase", side_effect=fake_run_phase)

    with pytest.raises(RetryBudgetExhausted) as excinfo:
        track_runner.run_track(track)

    assert excinfo.value.phase_number == 1
    assert excinfo.value.phase_name == "one"
