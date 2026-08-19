from __future__ import annotations

import json
import os
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Any

from orchestrate.errors import CommandError


class GhCommandError(CommandError):
    """A `gh` subprocess exited non-zero."""


@lru_cache(maxsize=32)
def _origin_repo(cwd: Path) -> str | None:
    """`owner/repo` of `cwd`'s `origin` remote, read from `.git/config` (no
    subprocess — side-effect-free and test-tolerant). Returns None when the
    file can't be read or the remote isn't a github.com url, in which case
    `gh` falls back to its own (less reliable) detection."""
    try:
        text = (Path(cwd) / ".git" / "config").read_text(encoding="utf-8")
    except OSError:
        return None
    in_origin, url = False, None
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("[remote "):
            in_origin = s == '[remote "origin"]'
            continue
        if in_origin and s.startswith("url"):
            url = s.split("=", 1)[1].strip()
    if not url:
        return None
    if url.startswith("git@github.com:"):
        slug = url[len("git@github.com:"):]
    elif "github.com/" in url:
        slug = url.split("github.com/", 1)[1]
    else:
        return None
    slug = slug[: -len(".git")] if slug.endswith(".git") else slug
    return slug or None


def _run(cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
    cmd = ["gh", *args]
    env = os.environ.copy()
    repo = _origin_repo(cwd)
    if repo:
        # Scope gh to the clone's origin repo explicitly — gh's own repo
        # detection resolved to the wrong (upstream) repo in the track clones,
        # which is what made `gh pr create` target the template repo.
        env["GH_REPO"] = repo
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
            timeout=120,
            env=env,
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


FOCUSED_REVIEW_MARKER = "[focused-review-bot]"


def _api_json(clone: Path, endpoint: str, *fields: str) -> Any:
    """`gh api` REST call: GET when no fields, POST when fields are given.
    Returns the parsed JSON body ({}, not None, when the endpoint returns no
    body)."""
    args = [endpoint]
    if fields:
        args += ["-X", "POST"]
        args += [a for f in fields for a in ("--raw-field", f)]
    result = _run(clone, "api", *args)
    body = result.stdout.strip()
    return json.loads(body) if body else {}


def thumbs_up_focused_review_replies(
    clone: Path, owner: str, repo: str, pr_number: int
) -> int:
    """Add a 👍 (+1) reaction to every inline review comment on the PR whose
    body carries FOCUSED_REVIEW_MARKER — the in-thread reply the focused-review
    runner posts under each Sonar comment it elaborates. This is the 'approved'
    signal that address-comments waits for when
    `require_reaction_for_focused_review = true`. Only marker-bearing comments
    are touched; the reaction is attributed to the authenticated gh identity
    (the same one address-comments' gate checks for). Idempotent: a comment we
    already +1'd is skipped rather than re-reacted (409), so re-running mid-
    cycle is safe. Returns the number of reactions actually added."""
    our_login = _api_json(clone, "user")["login"]
    added = 0
    page = 1
    while True:
        comments = _api_json(
            clone, f"repos/{owner}/{repo}/pulls/{pr_number}/comments?per_page=100&page={page}"
        )
        for comment in comments:
            if FOCUSED_REVIEW_MARKER not in (comment.get("body") or ""):
                continue
            comment_id = comment["id"]
            reactions = _api_json(
                clone, f"repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions?per_page=100"
            )
            if any(
                r.get("content") == "+1" and r.get("user", {}).get("login") == our_login
                for r in reactions
            ):
                continue
            _api_json(
                clone,
                f"repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions",
                "content=+1",
            )
            added += 1
        if len(comments) < 100:
            break
        page += 1
    return added


def review_decision(clone: Path, pr_number: int) -> str | None:
    """APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED | None. Only meaningful
    if the repo has branch-protection review requirements configured — use as
    a secondary signal alongside unresolved_thread_count, not the primary
    one."""
    result = _run(clone, "pr", "view", str(pr_number), "--json", "reviewDecision")
    data = json.loads(result.stdout)
    return data.get("reviewDecision") or None
