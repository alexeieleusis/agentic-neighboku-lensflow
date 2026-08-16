import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from orchestrate import git_ops


def _completed(returncode: int = 0, stdout: str = "", stderr: str = "") -> MagicMock:
    proc = MagicMock(spec=subprocess.CompletedProcess)
    proc.returncode = returncode
    proc.stdout = stdout
    proc.stderr = stderr
    return proc


def test_checkout_fresh_branch_fetches_then_checks_out(mocker) -> None:
    run = mocker.patch("orchestrate.git_ops.subprocess.run", return_value=_completed())

    git_ops.checkout_fresh_branch(Path("/repo"), "phase-01-foo", base="main")

    assert run.call_count == 2
    first_call, second_call = run.call_args_list
    assert first_call.args[0] == ["git", "fetch", "origin", "main"]
    assert second_call.args[0] == ["git", "checkout", "-B", "phase-01-foo", "origin/main"]
    assert first_call.kwargs["cwd"] == Path("/repo")


def test_commit_all_returns_false_on_clean_tree(mocker) -> None:
    run = mocker.patch(
        "orchestrate.git_ops.subprocess.run",
        side_effect=[_completed(), _completed(stdout="")],
    )

    made_commit = git_ops.commit_all(Path("/repo"), "implement phase 1")

    assert made_commit is False
    assert run.call_count == 2  # add, status — no commit call


def test_commit_all_commits_when_tree_dirty(mocker) -> None:
    run = mocker.patch(
        "orchestrate.git_ops.subprocess.run",
        side_effect=[_completed(), _completed(stdout=" M src/foo.ts\n"), _completed()],
    )

    made_commit = git_ops.commit_all(Path("/repo"), "implement phase 1")

    assert made_commit is True
    assert run.call_count == 3
    commit_call = run.call_args_list[2]
    assert commit_call.args[0] == ["git", "commit", "-m", "implement phase 1", "--"]


def test_push_branch_uses_force_with_lease(mocker) -> None:
    run = mocker.patch("orchestrate.git_ops.subprocess.run", return_value=_completed())

    git_ops.push_branch(Path("/repo"), "phase-01-foo")

    run.assert_called_once()
    assert run.call_args.args[0] == [
        "git",
        "push",
        "--force-with-lease",
        "-u",
        "origin",
        "phase-01-foo",
    ]


def test_fast_forward_push_does_not_force(mocker) -> None:
    run = mocker.patch("orchestrate.git_ops.subprocess.run", return_value=_completed())

    git_ops.fast_forward_push(Path("/repo"), "main")

    run.assert_called_once()
    assert run.call_args.args[0] == ["git", "push", "origin", "main"]


def test_fetch_resync_forces_branch_to_match_remote(mocker) -> None:
    run = mocker.patch("orchestrate.git_ops.subprocess.run", return_value=_completed())

    git_ops.fetch_resync(Path("/repo"), "phase-01-foo")

    first_call, second_call = run.call_args_list
    assert first_call.args[0] == ["git", "fetch", "origin", "phase-01-foo"]
    assert second_call.args[0] == [
        "git",
        "checkout",
        "-B",
        "phase-01-foo",
        "origin/phase-01-foo",
    ]


def test_diff_name_only_parses_lines(mocker) -> None:
    mocker.patch(
        "orchestrate.git_ops.subprocess.run",
        return_value=_completed(stdout="src/a.ts\nsrc/b.ts\n\n"),
    )

    files = git_ops.diff_name_only(Path("/repo"))

    assert files == ["src/a.ts", "src/b.ts"]


def test_diff_stat_parses_numstat_including_binary_files(mocker) -> None:
    mocker.patch(
        "orchestrate.git_ops.subprocess.run",
        return_value=_completed(stdout="10\t2\tsrc/a.ts\n-\t-\tpublic/img.png\n"),
    )

    files, added, removed = git_ops.diff_stat(Path("/repo"))

    assert files == 2
    assert added == 10
    assert removed == 2


def test_diff_stat_skips_malformed_numstat_lines(mocker) -> None:
    mocker.patch(
        "orchestrate.git_ops.subprocess.run",
        return_value=_completed(stdout="abc\t2\tsrc/a.ts\n10\t3\tsrc/b.ts\n"),
    )

    files, added, removed = git_ops.diff_stat(Path("/repo"))

    assert files == 2
    assert added == 10
    assert removed == 5


def test_run_raises_git_command_error_on_nonzero_exit(mocker) -> None:
    mocker.patch(
        "orchestrate.git_ops.subprocess.run",
        return_value=_completed(returncode=1, stderr="fatal: not a git repository"),
    )

    with pytest.raises(git_ops.GitCommandError, match="not a git repository"):
        git_ops.checkout_fresh_branch(Path("/repo"), "phase-01-foo")
