from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from orchestrate.errors import CommandError


class GhCommandError(CommandError):
    """A `gh` subprocess exited non-zero."""


def _run(cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
    cmd = ["gh", *args]
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
            timeout=120,
        )
    except subprocess.TimeoutExpired as exc:
        raise GhCommandError(
            cmd,
            -1,
            f"command timed out after 120s: stdout={exc.stdout!r}, stderr={exc.stderr!r}",
        ) from exc
    if result.returncode != 0:
        raise GhCommandError(cmd, result.returncode, result.stderr)
    return result


def pr_create(clone: Path, branch: str, title: str, body: str, base: str = "main") -> None:
    _run(
        clone,
        "pr",
        "create",
        "--title",
        title,
        "--body",
        body,
        "--base",
        base,
        "--head",
        branch,
    )


def pr_view(clone: Path) -> dict[str, Any]:
    """{"number": int, "url": str} for the PR on the branch checked out in
    `clone` — the authoritative source, rather than scraping `pr create`'s
    stdout."""
    result = _run(clone, "pr", "view", "--json", "number,url")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise GhCommandError(
            ["gh", "pr", "view", "--json", "number,url"], 1, f"invalid JSON: {exc}"
        ) from exc


def pr_merge(clone: Path, pr_number: int, method: str = "squash") -> None:
    _run(clone, "pr", "merge", str(pr_number), f"--{method}")


_UNRESOLVED_THREADS_QUERY = """
query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { endCursor hasNextPage }
        nodes { isResolved }
      }
    }
  }
}
"""


def unresolved_thread_count(clone: Path, owner: str, repo: str, pr_number: int) -> int:
    """Paginated `isResolved` count via `gh api graphql` — the iterate loop's
    continue signal, since self-review/address-comments both return exit 0
    regardless of whether anything was found or fixed."""
    count = 0
    cursor: str | None = None
    while True:
        args = [
            "api",
            "graphql",
            "-f",
            f"query={_UNRESOLVED_THREADS_QUERY}",
            "-f",
            f"owner={owner}",
            "-f",
            f"repo={repo}",
            "-F",
            f"pr={pr_number}",
        ]
        if cursor:
            args += ["-f", f"cursor={cursor}"]
        result = _run(clone, *args)
        data = json.loads(result.stdout)
        pr_data = data.get("data", {}).get("repository", {}).get("pullRequest")
        if pr_data is None:
            raise RuntimeError(f"PR {pr_number} not found in GraphQL response")
        threads = pr_data["reviewThreads"]
        count += sum(1 for node in threads["nodes"] if not node["isResolved"])
        if not threads["pageInfo"]["hasNextPage"]:
            break
        cursor = threads["pageInfo"]["endCursor"]
    return count


def review_decision(clone: Path, pr_number: int) -> str | None:
    """APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED | None. Only meaningful
    if the repo has branch-protection review requirements configured — use as
    a secondary signal alongside unresolved_thread_count, not the primary
    one."""
    result = _run(clone, "pr", "view", str(pr_number), "--json", "reviewDecision")
    data = json.loads(result.stdout)
    return data.get("reviewDecision") or None
