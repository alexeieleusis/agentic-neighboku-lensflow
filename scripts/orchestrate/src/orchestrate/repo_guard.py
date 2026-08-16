"""Defense against a backend/git operation landing in the wrong repo.

Added after an incident in dotharness's own repo (~/.harness): a `harness
run` invocation, launched from tools/pr-review with --config pointed at a
completely different repo, ended up fetching a branch and committing into
dotharness's own git history instead. Root-cause investigation (via
opencode's own structured logs) found opencode itself silently bootstraps a
second, unrequested instance pinned to tools/pr-review on a majority of
runs across the whole machine — independent of the --dir/cwd actually
passed, and predating any plugin/session code, so this can't be prevented
from the caller's side. It can only be detected and aborted before it
commits anything. Same risk applies here: opencode_runner.run() also
launches opencode directly.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

_GITHUB_URL_PREFIXES = (
    "git@github.com:",
    "https://github.com/",
    "ssh://git@github.com/",
)


class RepoIdentityError(RuntimeError):
    """`working_dir` is not the git repo `repo_slug` says it should be."""


def assert_repo_identity(working_dir: Path, expected_repo_slug: str) -> None:
    """Raise RepoIdentityError unless `working_dir` is the toplevel of a git
    worktree whose `origin` remote resolves to `expected_repo_slug` (an
    'owner/repo' slug, e.g. TrackConfig.repo_slug)."""
    working_dir = working_dir.resolve()

    toplevel = subprocess.run(
        ["git", "-C", str(working_dir), "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=False,
    )
    if toplevel.returncode != 0:
        raise RepoIdentityError(
            f"{working_dir} is not inside a git repository "
            f"(git rev-parse --show-toplevel failed: {toplevel.stderr.strip()})"
        )
    actual_toplevel = Path(toplevel.stdout.strip()).resolve()
    if actual_toplevel != working_dir:
        raise RepoIdentityError(
            f"{working_dir} is not itself the toplevel of its git repo "
            f"(toplevel is {actual_toplevel}) — refusing to operate on what looks "
            "like a subdirectory of some other checkout"
        )

    origin = subprocess.run(
        ["git", "-C", str(working_dir), "remote", "get-url", "origin"],
        capture_output=True,
        text=True,
        check=False,
    )
    if origin.returncode != 0:
        raise RepoIdentityError(
            f"{working_dir} has no 'origin' remote "
            f"(git remote get-url origin failed: {origin.stderr.strip()})"
        )
    origin_url = origin.stdout.strip()
    if not _origin_matches_repo(origin_url, expected_repo_slug):
        raise RepoIdentityError(
            f"{working_dir}'s origin ({origin_url!r}) does not match the configured "
            f"repo_slug {expected_repo_slug!r} — refusing to run a backend/git "
            "operation against what looks like the wrong repo"
        )


def _origin_matches_repo(url: str, repo_slug: str) -> bool:
    """`repo_slug` is an 'owner/repo' slug; `url` is origin's fetch URL in
    whatever form git reports it (SSH, HTTPS, with or without '.git')."""
    normalized = url.strip()
    for prefix in _GITHUB_URL_PREFIXES:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix) :]
            break
    normalized = normalized.removesuffix(".git").rstrip("/")
    return normalized == repo_slug
