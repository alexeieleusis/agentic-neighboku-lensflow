from __future__ import annotations

import json
import os
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Any

from orchestrate.config import VIBE_HEAL_TOOL_DIR
from orchestrate.errors import CommandError

Fingerprint = tuple[str, str, int]


class VibeHealCommandError(CommandError):
    pass


@lru_cache(maxsize=1)
def _discover_sonar_scanner_bin_dir() -> Path | None:
    """sonar-scanner is installed at ~/usr/sonarqube/sonar-scanner-<version>/bin
    (version-specific directory name, not a fixed path) and isn't reliably on
    PATH for a subprocess — glob for it rather than hardcoding a version.
    Cached: the installed location can't change within a process, and this
    would otherwise re-glob the filesystem on every scan()/post() call."""
    base = Path("~/usr/sonarqube").expanduser()
    if not base.is_dir():
        return None
    for candidate in sorted(base.glob("sonar-scanner-*/bin")):
        if (candidate / "sonar-scanner").exists():
            return candidate
    return None


def _env_with_sonar_scanner_on_path() -> dict[str, str]:
    env = os.environ.copy()
    bin_dir = _discover_sonar_scanner_bin_dir()
    if bin_dir is not None:
        env["PATH"] = f"{bin_dir}{os.pathsep}{env.get('PATH', '')}"
    return env


def _run(review_clone: Path, *args: str) -> subprocess.CompletedProcess[str]:
    # `uv run --project <dir>` selects which pyproject/venv uv resolves
    # against — it does NOT chdir (confirmed live). The subprocess cwd must
    # be review_clone or vibe-heal analyzes its own repo instead of the
    # track's.
    full_args = ["uv", "run", "--project", str(VIBE_HEAL_TOOL_DIR), "vibe-heal", *args]
    result = subprocess.run(
        full_args,
        cwd=review_clone,
        capture_output=True,
        text=True,
        check=False,
        env=_env_with_sonar_scanner_on_path(),
        timeout=300,
    )
    if result.returncode != 0:
        raise VibeHealCommandError(full_args, result.returncode, result.stderr)
    return result


def scan(
    review_clone: Path,
    *,
    report_file: Path,
    env_file: Path,
    pr_number: int,
    base_branch: str = "main",
) -> dict[str, Any]:
    """Runs `vibe-heal review` (analysis only, no posting) and returns the
    parsed review.json. Always pass --report-file explicitly — omitting it
    risks a `sys.exit(1)` if default-path SonarQube-config resolution fails."""
    _run(
        review_clone,
        "review",
        "--base-branch",
        base_branch,
        "--pr",
        str(pr_number),
        "--report-file",
        str(report_file),
        "--env-file",
        str(env_file),
    )
    return json.loads(report_file.read_text(encoding="utf-8"))


def post(
    review_clone: Path,
    *,
    report_file: Path,
    env_file: Path,
    pr_number: int,
    dry_run: bool = False,
) -> None:
    """Runs `vibe-heal review --post` against an already-written report.json.
    Has no deduplication (confirmed by reading source) — the caller decides
    whether to call this at all via should_post()."""
    args = [
        "review",
        "--post",
        "--pr",
        str(pr_number),
        "--report-file",
        str(report_file),
        "--env-file",
        str(env_file),
    ]
    if dry_run:
        args.append("--dry-run")
    _run(review_clone, *args)


def fingerprints_from_report(report: dict[str, Any]) -> set[Fingerprint]:
    """(file, rule, line) identity for every changed-line issue in a
    review.json payload — restricted to on_changed_line=True, the only
    issues vibe-heal actually posts (others 422 on trailing-context lines)."""
    fingerprints: set[Fingerprint] = set()
    for file_review in report.get("files", []):
        file_path = file_review["file_path"]
        for issue in file_review.get("issues", []):
            if issue.get("on_changed_line"):
                fingerprints.add((file_path, issue["rule"], issue["line"]))
    return fingerprints


def should_post(current: set[Fingerprint], already_posted: set[Fingerprint]) -> bool:
    """Post only if this cycle surfaced a fingerprint never posted before —
    the dedup decision from the plan. An unchanged or shrinking issue set
    means the already-open threads from an earlier post are still live for
    address-comments to keep working; reposting the same set is pure noise."""
    return bool(current - already_posted)


def diff_fingerprints(
    previous: set[Fingerprint], current: set[Fingerprint]
) -> tuple[int, int]:
    """(newly_opened, resolved) counts between two cycles' fingerprint sets,
    for PhaseMetrics.sonar_issues_opened/resolved."""
    opened = len(current - previous)
    resolved = len(previous - current)
    return opened, resolved
