from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Literal

from orchestrate.config import HARNESS_TOOL_DIR
from orchestrate.errors import CommandError

Subcommand = Literal["self-review", "address-comments"]


class HarnessCommandError(CommandError):
    """A `harness run` subprocess exited non-zero. Note: this only happens on
    lock contention, a fatal git error, or bad config — self-review and
    address-comments both swallow per-PR errors internally and return exit 0
    regardless of whether anything was found or fixed. A clean exit here is
    NOT evidence the PR is actually clean; the caller must check GitHub state
    (gh_ops.unresolved_thread_count) separately."""


def run(
    review_clone: Path,
    harness_config: Path,
    subcommand: Subcommand,
    *,
    verbose: bool = False,
    timeout: int = 1800,
) -> str:
    """Repo targeting is entirely via `harness_config`'s [repo].working_dir —
    there is no --dir/--repo flag. `review_clone` is only used as the
    subprocess cwd for consistency with the other `uv run --project ...`
    invocations (uv's --project does not chdir, confirmed live)."""
    args = ["uv", "run", "--project", str(HARNESS_TOOL_DIR), "harness", "run"]
    if verbose:
        args.append("--verbose")
    args += ["--config", str(harness_config), subcommand]
    result = subprocess.run(
        args,
        cwd=review_clone,
        capture_output=True,
        text=True,
        check=False,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise HarnessCommandError(args, result.returncode, result.stderr)
    return result.stdout


def self_review(review_clone: Path, harness_config: Path, *, verbose: bool = False) -> str:
    """Step 4: reviews PRs authored by the harness's own `gh` identity — the
    correct choice for a PR this script just opened itself (confirmed via
    source: `review-requested` is for PRs where the harness identity is a
    requested reviewer of someone else's PR)."""
    return run(review_clone, harness_config, "self-review", verbose=verbose)


def address_comments(review_clone: Path, harness_config: Path, *, verbose: bool = False) -> str:
    """Step 5: pushes fixes for unresolved review threads on open PRs
    authored-by-or-assigned-to the harness identity in this repo."""
    return run(review_clone, harness_config, "address-comments", verbose=verbose)
