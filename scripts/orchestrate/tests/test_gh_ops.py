import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from orchestrate import gh_ops


def _completed(returncode: int = 0, stdout: str = "", stderr: str = "") -> MagicMock:
    proc = MagicMock(spec=subprocess.CompletedProcess)
    proc.returncode = returncode
    proc.stdout = stdout
    proc.stderr = stderr
    return proc


def test_pr_create_passes_title_body_base_head(mocker) -> None:
    run = mocker.patch("orchestrate.gh_ops.subprocess.run", return_value=_completed())

    gh_ops.pr_create(Path("/repo"), "phase-01-foo", "Phase 1: foo", "- criterion one")

    run.assert_called_once()
    args = run.call_args.args[0]
    assert args[:2] == ["gh", "pr"]
    assert "create" in args
    assert "--title" in args and "Phase 1: foo" in args
    assert "--body" in args and "- criterion one" in args
    assert "--base" in args and "main" in args
    assert "--head" in args and "phase-01-foo" in args


def test_pr_view_parses_json(mocker) -> None:
    mocker.patch(
        "orchestrate.gh_ops.subprocess.run",
        return_value=_completed(stdout='{"number": 7, "url": "https://github.com/o/r/pull/7"}'),
    )

    result = gh_ops.pr_view(Path("/repo"))

    assert result == {"number": 7, "url": "https://github.com/o/r/pull/7"}


def test_pr_view_raises_on_invalid_json(mocker) -> None:
    mocker.patch(
        "orchestrate.gh_ops.subprocess.run",
        return_value=_completed(stdout="{truncated"),
    )

    with pytest.raises(gh_ops.GhCommandError, match="invalid JSON"):
        gh_ops.pr_view(Path("/repo"))


def test_pr_merge_uses_squash_by_default(mocker) -> None:
    run = mocker.patch("orchestrate.gh_ops.subprocess.run", return_value=_completed())

    gh_ops.pr_merge(Path("/repo"), 7)

    assert run.call_args.args[0] == ["gh", "pr", "merge", "7", "--squash"]


def _thread_page(nodes: list[dict], has_next: bool, cursor: str | None = None) -> str:
    return json.dumps(
        {
            "data": {
                "repository": {
                    "pullRequest": {
                        "reviewThreads": {
                            "pageInfo": {"endCursor": cursor, "hasNextPage": has_next},
                            "nodes": nodes,
                        }
                    }
                }
            }
        }
    )


def test_unresolved_thread_count_single_page(mocker) -> None:
    mocker.patch(
        "orchestrate.gh_ops.subprocess.run",
        return_value=_completed(
            stdout=_thread_page(
                [{"isResolved": True}, {"isResolved": False}, {"isResolved": False}],
                has_next=False,
            )
        ),
    )

    count = gh_ops.unresolved_thread_count(Path("/repo"), "owner", "repo", 7)

    assert count == 2


def test_unresolved_thread_count_paginates(mocker) -> None:
    run = mocker.patch(
        "orchestrate.gh_ops.subprocess.run",
        side_effect=[
            _completed(
                stdout=_thread_page([{"isResolved": False}], has_next=True, cursor="CURSOR1")
            ),
            _completed(
                stdout=_thread_page(
                    [{"isResolved": False}, {"isResolved": True}], has_next=False
                )
            ),
        ],
    )

    count = gh_ops.unresolved_thread_count(Path("/repo"), "owner", "repo", 7)

    assert count == 2
    assert run.call_count == 2
    second_call_args = run.call_args_list[1].args[0]
    assert "-f" in second_call_args
    assert "cursor=CURSOR1" in second_call_args


def test_review_decision_returns_none_when_null(mocker) -> None:
    mocker.patch(
        "orchestrate.gh_ops.subprocess.run",
        return_value=_completed(stdout='{"reviewDecision": null}'),
    )

    assert gh_ops.review_decision(Path("/repo"), 7) is None


def test_review_decision_returns_value(mocker) -> None:
    mocker.patch(
        "orchestrate.gh_ops.subprocess.run",
        return_value=_completed(stdout='{"reviewDecision": "CHANGES_REQUESTED"}'),
    )

    assert gh_ops.review_decision(Path("/repo"), 7) == "CHANGES_REQUESTED"


def test_run_raises_gh_command_error_on_nonzero_exit(mocker) -> None:
    mocker.patch(
        "orchestrate.gh_ops.subprocess.run",
        return_value=_completed(returncode=1, stderr="no pull requests found"),
    )

    with pytest.raises(gh_ops.GhCommandError, match="no pull requests found"):
        gh_ops.pr_view(Path("/repo"))
