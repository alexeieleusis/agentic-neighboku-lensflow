from pathlib import Path

import pytest

from orchestrate import scope_guard
from orchestrate.errors import ScopeViolation


def test_matches_any_exact_path() -> None:
    assert scope_guard.matches_any("game/gameBuilder.ts", ["game/gameBuilder.ts"])


def test_matches_any_glob_star() -> None:
    assert scope_guard.matches_any(
        "src/components/Foo/Foo.tsx", ["src/components/Foo/*"]
    )


def test_matches_any_false_for_unrelated_path() -> None:
    assert not scope_guard.matches_any("src/App.tsx", ["game/*"])


def test_matches_any_glob_question_mark() -> None:
    assert scope_guard.matches_any("src/Foo1.tsx", ["src/Foo?.tsx"])
    assert not scope_guard.matches_any("src/Foo12.tsx", ["src/Foo?.tsx"])


def test_matches_any_glob_character_class() -> None:
    assert scope_guard.matches_any("src/Foo.tsx", ["src/[A-Z]*.tsx"])
    assert not scope_guard.matches_any("src/foo.tsx", ["src/[A-Z]*.tsx"])


def test_matches_any_does_not_match_a_prefixed_path_outside_the_glob() -> None:
    """Regression test for a Path.match()-based implementation: Path.match()
    anchors from the right unless the pattern is absolute, so it would
    wrongly treat "evil/src/components/Foo/Foo.tsx" as within scope for
    "src/components/Foo/*" — the exact bypass this guard exists to prevent."""
    assert not scope_guard.matches_any(
        "evil/src/components/Foo/Foo.tsx", ["src/components/Foo/*"]
    )


def test_check_passes_when_diff_within_scope(mocker) -> None:
    mocker.patch(
        "orchestrate.scope_guard.git_ops.diff_name_only",
        return_value=["game/gameBuilder.ts", "game/__tests__/gameBuilder.test.ts"],
    )

    scope_guard.check(Path("/clone"), ["game/gameBuilder.ts", "game/__tests__/*"])


def test_check_raises_scope_violation_with_offending_files(mocker) -> None:
    mocker.patch(
        "orchestrate.scope_guard.git_ops.diff_name_only",
        return_value=["game/gameBuilder.ts", "src/App.tsx"],
    )

    with pytest.raises(ScopeViolation) as excinfo:
        scope_guard.check(Path("/clone"), ["game/gameBuilder.ts"])

    assert excinfo.value.offending_files == ["src/App.tsx"]
    assert excinfo.value.allowed_globs == ["game/gameBuilder.ts"]


def test_check_no_exception_for_empty_diff(mocker) -> None:
    mocker.patch("orchestrate.scope_guard.git_ops.diff_name_only", return_value=[])

    scope_guard.check(Path("/clone"), ["game/gameBuilder.ts"])
