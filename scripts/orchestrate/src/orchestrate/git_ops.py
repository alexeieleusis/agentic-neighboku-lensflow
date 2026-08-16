from __future__ import annotations

import contextlib
import subprocess
from pathlib import Path

from orchestrate.errors import CommandError


class GitCommandError(CommandError):
    """A git subprocess exited non-zero. Distinct from the phase-workflow
    escalation categories in orchestrate.errors — this represents an
    environment/plumbing failure, not a review-loop outcome."""


def _run(clone: Path, *args: str) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", *args],
        cwd=clone,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise GitCommandError(["git", *args], result.returncode, result.stderr)
    return result


def checkout_fresh_branch(clone: Path, branch: str, base: str = "main") -> None:
    """Create `branch` off origin/`base` in `clone`, discarding any prior
    local branch of the same name — safe to re-run (e.g. on a retried step
    1), since it always starts from the remote's current base, never from
    whatever was locally lying around."""
    _run(clone, "fetch", "origin", base)
    _run(clone, "checkout", "-B", branch, f"origin/{base}")


def commit_all(clone: Path, message: str) -> bool:
    """Stage and commit everything in `clone`. Returns False (no commit made)
    if the working tree was already clean — the caller uses this to raise
    EmptyImplementationError rather than open an empty PR."""
    _run(clone, "add", "-A")
    status = _run(clone, "status", "--porcelain")
    if not status.stdout.strip():
        return False
    _run(clone, "commit", "-m", message, "--")
    return True


def push_branch(clone: Path, branch: str, remote: str = "origin") -> None:
    """`--force-with-lease` so a retried step 1 (which recreates `branch`
    fresh off origin/main via checkout_fresh_branch) can overwrite a stale
    remote branch from an earlier, abandoned attempt, while still protecting
    against clobbering an unexpected concurrent push."""
    _run(clone, "push", "--force-with-lease", "-u", remote, branch)


def fast_forward_push(clone: Path, branch: str, remote: str = "origin") -> None:
    """Plain (non-force) push — for the metrics module's append-only commits
    to `base_branch`, made immediately after a fetch_resync so a fast-forward
    is expected. Deliberately does not force: a rejected push here (someone
    else committed to main in between) should surface as an error, not
    silently overwrite."""
    _run(clone, "push", remote, branch)


def fetch_resync(clone: Path, branch: str, remote: str = "origin") -> None:
    """Force `clone` to exactly match `remote/branch`. Safe unconditionally
    because `review_clone` is never committed into directly — see the plan's
    two-clone rationale. Called before every iterate cycle to pick up
    address-comments' own pushes."""
    _run(clone, "fetch", remote, branch)
    _run(clone, "checkout", "-B", branch, f"{remote}/{branch}")


def diff_name_only(clone: Path, base_ref: str = "origin/main") -> list[str]:
    result = _run(clone, "diff", "--name-only", f"{base_ref}...HEAD")
    return [line for line in result.stdout.splitlines() if line.strip()]


def diff_stat(clone: Path, base_ref: str = "origin/main") -> tuple[int, int, int]:
    """Returns (files_changed, lines_added, lines_removed) for PhaseMetrics."""
    result = _run(clone, "diff", "--numstat", f"{base_ref}...HEAD")
    files = 0
    added = 0
    removed = 0
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        files += 1
        a, r, _path = parts
        if a != "-":
            with contextlib.suppress(ValueError):
                added += int(a)
        if r != "-":
            with contextlib.suppress(ValueError):
                removed += int(r)
    return files, added, removed
