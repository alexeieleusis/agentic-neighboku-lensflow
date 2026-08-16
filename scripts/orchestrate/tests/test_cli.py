from pathlib import Path

from typer.testing import CliRunner

from orchestrate.cli import app
from orchestrate.errors import RetryBudgetExhausted, ScopeViolation

runner = CliRunner()

PHASE_FILE_CONTENT = """# Phase 1 — Domain core

## Scope (files this phase may create/modify)
- game/entities.ts

## Requirements
See requirements.md §3.1.

## Acceptance criteria
- Neighbor rule matches exactly one attribute.

## Manual test checklist

## Depends on
- None (first phase).
"""


def _run_phase_args(tmp_path: Path, phase_file: Path) -> list[str]:
    return [
        "run-phase",
        "--phase-file",
        str(phase_file),
        "--track",
        "baseline",
        "--repo",
        "acme/neighboku-ai-baseline",
        "--impl-clone",
        str(tmp_path / "impl"),
        "--review-clone",
        str(tmp_path / "review"),
        "--harness-config",
        str(tmp_path / ".harness.toml"),
        "--vibe-heal-env-file",
        str(tmp_path / ".env.vibeheal"),
    ]


def _phase_file(tmp_path: Path) -> Path:
    path = tmp_path / "01-domain-core.md"
    path.write_text(PHASE_FILE_CONTENT, encoding="utf-8")
    return path


def test_run_phase_dry_run_exits_zero(tmp_path: Path) -> None:
    phase_file = _phase_file(tmp_path)

    result = runner.invoke(app, _run_phase_args(tmp_path, phase_file) + ["--dry-run"])

    assert result.exit_code == 0
    assert "merged" in result.output


def test_run_phase_maps_scope_violation_to_its_exit_code(tmp_path: Path, mocker) -> None:
    phase_file = _phase_file(tmp_path)
    mocker.patch(
        "orchestrate.cli._run_phase",
        side_effect=ScopeViolation(["src/App.tsx"], ["game/entities.ts"]),
    )

    result = runner.invoke(app, _run_phase_args(tmp_path, phase_file))

    assert result.exit_code == 11
    assert "outside declared scope" in result.output


def test_run_phase_maps_retry_budget_exhausted_to_its_exit_code(tmp_path: Path, mocker) -> None:
    phase_file = _phase_file(tmp_path)
    mocker.patch(
        "orchestrate.cli._run_phase",
        side_effect=RetryBudgetExhausted(3, "https://x.invalid/pull/1", 2),
    )

    result = runner.invoke(app, _run_phase_args(tmp_path, phase_file))

    assert result.exit_code == 13
    assert "unresolved review thread" in result.output


def test_run_phase_missing_phase_file_fails_at_runtime(tmp_path: Path) -> None:
    result = runner.invoke(
        app, _run_phase_args(tmp_path, tmp_path / "does-not-exist.md")
    )

    assert result.exit_code == 2
    assert "does not exist" in result.output


def test_status_command_reports_pending_phase(tmp_path: Path) -> None:
    review_clone = tmp_path / "review"
    (review_clone / "docs" / "phases").mkdir(parents=True)
    (review_clone / "docs" / "phases" / "01-domain-core.md").write_text(
        PHASE_FILE_CONTENT, encoding="utf-8"
    )

    result = runner.invoke(
        app, ["status", "--track", "baseline", "--review-clone", str(review_clone)]
    )

    assert result.exit_code == 0
    assert "pending" in result.output
    assert "domain-core" in result.output
