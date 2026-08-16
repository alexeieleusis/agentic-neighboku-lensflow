from __future__ import annotations

import subprocess
from pathlib import Path

from orchestrate.errors import MergeGateFailure

_GATES: list[tuple[str, list[str]]] = [
    ("install", ["pnpm", "install", "--frozen-lockfile"]),
    ("build", ["pnpm", "build"]),
    ("lint", ["pnpm", "lint"]),
    ("test", ["pnpm", "test", "run"]),
]

_TAIL_LINES = 40


def run(review_clone: Path) -> None:
    """Hard merge gates (implementation-plan.md §4.4): no merge with a
    failing pnpm build/lint/test. Uses this repo's real scripts — the track
    repos are scaffolded from this pnpm template, not `npm run *` as the
    plan doc's own §4.4 literally (and, for this template, incorrectly)
    says. Raises on the first failing gate rather than running all of them,
    so the escalation names one clear cause."""
    for name, command in _GATES:
        try:
            result = subprocess.run(
                command,
                cwd=review_clone,
                capture_output=True,
                text=True,
                check=False,
            )
        except OSError as exc:
            raise MergeGateFailure(name, str(exc)) from exc
        if result.returncode != 0:
            tail = "\n".join((result.stdout + result.stderr).splitlines()[-_TAIL_LINES:])
            raise MergeGateFailure(name, tail)
