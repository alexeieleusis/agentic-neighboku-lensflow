import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from orchestrate import harness_runner


def _completed(returncode: int = 0, stdout: str = "", stderr: str = "") -> MagicMock:
    proc = MagicMock(spec=subprocess.CompletedProcess)
    proc.returncode = returncode
    proc.stdout = stdout
    proc.stderr = stderr
    return proc


def test_run_targets_repo_via_config_not_cli_flag(mocker) -> None:
    run = mocker.patch(
        "orchestrate.harness_runner.subprocess.run", return_value=_completed(stdout="ok")
    )

    output = harness_runner.run(
        Path("/review-clone"), Path("/repo/.harness.toml"), "self-review"
    )

    assert output == "ok"
    run.assert_called_once()
    args = run.call_args.args[0]
    assert args[:3] == ["uv", "run", "--project"]
    assert "harness" in args and "run" in args
    assert "--config" in args and "/repo/.harness.toml" in args
    assert args[-1] == "self-review"
    assert "--dir" not in args  # no such flag — targeting is config-only
    assert run.call_args.kwargs["cwd"] == Path("/review-clone")


def test_verbose_flag_is_inserted_before_config(mocker) -> None:
    run = mocker.patch(
        "orchestrate.harness_runner.subprocess.run", return_value=_completed()
    )

    harness_runner.run(
        Path("/review-clone"), Path("/repo/.harness.toml"), "address-comments", verbose=True
    )

    args = run.call_args.args[0]
    assert "--verbose" in args
    assert args.index("--verbose") < args.index("--config")


def test_self_review_convenience_wrapper_uses_self_review_subcommand(mocker) -> None:
    run = mocker.patch(
        "orchestrate.harness_runner.subprocess.run", return_value=_completed()
    )

    harness_runner.self_review(Path("/review-clone"), Path("/repo/.harness.toml"))

    assert run.call_args.args[0][-1] == "self-review"


def test_address_comments_convenience_wrapper_uses_address_comments_subcommand(
    mocker,
) -> None:
    run = mocker.patch(
        "orchestrate.harness_runner.subprocess.run", return_value=_completed()
    )

    harness_runner.address_comments(Path("/review-clone"), Path("/repo/.harness.toml"))

    assert run.call_args.args[0][-1] == "address-comments"


def test_raises_on_nonzero_exit_lock_contention(mocker) -> None:
    mocker.patch(
        "orchestrate.harness_runner.subprocess.run",
        return_value=_completed(returncode=1, stderr="another harness instance is running"),
    )

    with pytest.raises(harness_runner.HarnessCommandError, match="another harness instance"):
        harness_runner.self_review(Path("/review-clone"), Path("/repo/.harness.toml"))


def test_zero_exit_does_not_mean_clean_caller_must_check_gh(mocker) -> None:
    """Documents the weak-exit-code caveat: a clean exit 0 must not be
    interpreted as 'no findings' by any caller of this module."""
    run = mocker.patch(
        "orchestrate.harness_runner.subprocess.run", return_value=_completed(returncode=0)
    )

    # Should not raise even though nothing about the PR's real state is known.
    harness_runner.self_review(Path("/review-clone"), Path("/repo/.harness.toml"))
    run.assert_called_once()
