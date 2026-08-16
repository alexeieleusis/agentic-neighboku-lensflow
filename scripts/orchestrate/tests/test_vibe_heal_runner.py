import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from orchestrate import vibe_heal_runner


def _completed(returncode: int = 0, stdout: str = "", stderr: str = "") -> MagicMock:
    proc = MagicMock(spec=subprocess.CompletedProcess)
    proc.returncode = returncode
    proc.stdout = stdout
    proc.stderr = stderr
    return proc


def _report(*, files: list[dict]) -> dict:
    return {
        "project_key": "proj",
        "branch": "phase-01-foo",
        "base_branch": "main",
        "files": files,
        "files_analyzed": len(files),
    }


# --- fingerprints_from_report -------------------------------------------------


def test_fingerprints_only_include_on_changed_line_issues() -> None:
    report = _report(
        files=[
            {
                "file_path": "src/a.ts",
                "issues": [
                    {"rule": "S1234", "line": 10, "on_changed_line": True},
                    {"rule": "S5678", "line": 20, "on_changed_line": False},
                ],
            }
        ]
    )

    fingerprints = vibe_heal_runner.fingerprints_from_report(report)

    assert fingerprints == {("src/a.ts", "S1234", 10)}


def test_fingerprints_across_multiple_files() -> None:
    report = _report(
        files=[
            {
                "file_path": "src/a.ts",
                "issues": [{"rule": "S1", "line": 1, "on_changed_line": True}],
            },
            {
                "file_path": "src/b.ts",
                "issues": [{"rule": "S2", "line": 2, "on_changed_line": True}],
            },
        ]
    )

    fingerprints = vibe_heal_runner.fingerprints_from_report(report)

    assert fingerprints == {("src/a.ts", "S1", 1), ("src/b.ts", "S2", 2)}


def test_fingerprints_empty_when_no_issues() -> None:
    report = _report(files=[{"file_path": "src/a.ts", "issues": []}])

    assert vibe_heal_runner.fingerprints_from_report(report) == set()


# --- should_post (the dedup decision) -----------------------------------------


def test_should_post_true_when_a_new_fingerprint_appears() -> None:
    posted = {("src/a.ts", "S1", 1)}
    current = {("src/a.ts", "S1", 1), ("src/b.ts", "S2", 2)}

    assert vibe_heal_runner.should_post(current, posted) is True


def test_should_post_false_when_set_is_unchanged() -> None:
    posted = {("src/a.ts", "S1", 1)}
    current = {("src/a.ts", "S1", 1)}

    assert vibe_heal_runner.should_post(current, posted) is False


def test_should_post_false_when_set_only_shrank() -> None:
    posted = {("src/a.ts", "S1", 1), ("src/b.ts", "S2", 2)}
    current = {("src/a.ts", "S1", 1)}

    assert vibe_heal_runner.should_post(current, posted) is False


def test_should_post_false_when_everything_resolved() -> None:
    posted = {("src/a.ts", "S1", 1)}
    current: set = set()

    assert vibe_heal_runner.should_post(current, posted) is False


def test_should_post_true_on_first_cycle_with_nothing_posted_yet() -> None:
    posted: set = set()
    current = {("src/a.ts", "S1", 1)}

    assert vibe_heal_runner.should_post(current, posted) is True


# --- diff_fingerprints ----------------------------------------------------------


def test_diff_fingerprints_counts_opened_and_resolved() -> None:
    previous = {("src/a.ts", "S1", 1), ("src/b.ts", "S2", 2)}
    current = {("src/b.ts", "S2", 2), ("src/c.ts", "S3", 3)}

    opened, resolved = vibe_heal_runner.diff_fingerprints(previous, current)

    assert opened == 1  # src/c.ts appeared
    assert resolved == 1  # src/a.ts disappeared


# --- scan/post subprocess shape (uv --project does not chdir) -----------------


def test_scan_runs_with_cwd_set_to_review_clone_not_vibe_heal_dir(
    mocker, tmp_path: Path
) -> None:
    report_file = tmp_path / "review.json"
    report_file.write_text(json.dumps(_report(files=[])), encoding="utf-8")
    review_clone = tmp_path / "review-clone"
    review_clone.mkdir()

    run = mocker.patch(
        "orchestrate.vibe_heal_runner.subprocess.run", return_value=_completed()
    )
    mocker.patch(
        "orchestrate.vibe_heal_runner._discover_sonar_scanner_bin_dir",
        return_value=None,
    )

    result = vibe_heal_runner.scan(
        review_clone,
        report_file=report_file,
        env_file=tmp_path / ".env.vibeheal",
        pr_number=7,
    )

    assert result["project_key"] == "proj"
    run.assert_called_once()
    assert run.call_args.kwargs["cwd"] == review_clone
    args = run.call_args.args[0]
    assert args[:3] == ["uv", "run", "--project"]
    assert "vibe-heal" in args
    assert "review" in args
    assert "--post" not in args
    assert "--report-file" in args and str(report_file) in args


def test_post_passes_post_and_pr_and_dry_run_flags(mocker, tmp_path: Path) -> None:
    review_clone = tmp_path / "review-clone"
    review_clone.mkdir()
    run = mocker.patch(
        "orchestrate.vibe_heal_runner.subprocess.run", return_value=_completed()
    )
    mocker.patch(
        "orchestrate.vibe_heal_runner._discover_sonar_scanner_bin_dir",
        return_value=None,
    )

    vibe_heal_runner.post(
        review_clone,
        report_file=tmp_path / "review.json",
        env_file=tmp_path / ".env.vibeheal",
        pr_number=7,
        dry_run=True,
    )

    args = run.call_args.args[0]
    assert "--post" in args
    assert "--pr" in args and "7" in args
    assert "--dry-run" in args
    assert run.call_args.kwargs["cwd"] == review_clone


def test_run_raises_on_nonzero_exit(mocker, tmp_path: Path) -> None:
    review_clone = tmp_path / "review-clone"
    review_clone.mkdir()
    mocker.patch(
        "orchestrate.vibe_heal_runner.subprocess.run",
        return_value=_completed(returncode=1, stderr="ValidationError: SONARQUBE_URL"),
    )
    mocker.patch(
        "orchestrate.vibe_heal_runner._discover_sonar_scanner_bin_dir",
        return_value=None,
    )

    with pytest.raises(vibe_heal_runner.VibeHealCommandError, match="SONARQUBE_URL"):
        vibe_heal_runner.scan(
            review_clone,
            report_file=tmp_path / "review.json",
            env_file=tmp_path / ".env.vibeheal",
            pr_number=7,
        )


def test_prepends_discovered_sonar_scanner_to_path(mocker, tmp_path: Path) -> None:
    review_clone = tmp_path / "review-clone"
    review_clone.mkdir()
    bin_dir = tmp_path / "sonar-scanner-9.0-linux-x64" / "bin"
    bin_dir.mkdir(parents=True)
    run = mocker.patch(
        "orchestrate.vibe_heal_runner.subprocess.run", return_value=_completed()
    )
    mocker.patch(
        "orchestrate.vibe_heal_runner._discover_sonar_scanner_bin_dir",
        return_value=bin_dir,
    )

    vibe_heal_runner.post(
        review_clone,
        report_file=tmp_path / "review.json",
        env_file=tmp_path / ".env.vibeheal",
        pr_number=7,
    )

    passed_path = run.call_args.kwargs["env"]["PATH"]
    assert str(bin_dir) in passed_path.split(":")
