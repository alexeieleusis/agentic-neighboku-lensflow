from __future__ import annotations

from fnmatch import fnmatch
from pathlib import Path

from orchestrate import git_ops
from orchestrate.errors import ScopeViolation


def matches_any(path: str, globs: list[str]) -> bool:
    """fnmatch, not Path.match: Path.match() anchors from the right unless
    the pattern is absolute, so e.g. Path("evil/src/App.tsx").match("src/*")
    is True — a real scope-guard bypass for a check whose whole job is
    keeping a diff inside its declared globs. fnmatch always matches the
    full string."""
    return any(fnmatch(path, glob) for glob in globs)


def check(clone: Path, scope_globs: list[str], *, base_ref: str = "origin/main") -> None:
    """Raises ScopeViolation if the diff touches any file outside
    scope_globs (implementation-plan.md §4.1). No built-in exceptions for
    package.json/lockfiles etc. — the guard enforces exactly what the phase
    file's own '## Scope' section declares; a phase needing a new dependency
    lists it there.

    Called twice per implementation-plan.md's iterate step: immediately
    after step 1's commit (fail fast, before pushing), and again after every
    resync during steps 3-5, since address-comments' own pushes can widen
    the diff past the declared scope.
    """
    changed = git_ops.diff_name_only(clone, base_ref=base_ref)
    offending = [path for path in changed if not matches_any(path, scope_globs)]
    if offending:
        raise ScopeViolation(offending, scope_globs)
