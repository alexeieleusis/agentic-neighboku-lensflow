from pathlib import Path

import pytest

from orchestrate.phase_file import parse_phase_file

SAMPLE = """# Phase 3 — Puzzle unfolding & move engine

## Scope (files this phase may create/modify)
- game/gameBuilder.ts
- game/__tests__/gameBuilder.test.ts

## Requirements
See requirements.md §3.4, §3.5, §3.6.

`unfoldGame` blanks locked cells; `placePiece` throws on an invalid move when
`preventInvalidMoves` is true.

## Acceptance criteria
- `unfoldGame` stops when no locked cells remain.
- `placePiece` throws on invalid moves when the preference is enabled.
- `undoPlay` restores the piece to the tray.

## Manual test checklist
- N/A (unit-test only)

## Depends on
- Phase 2 merged.
"""

NO_UI_SAMPLE = """# Phase 1 — Domain core: attributes & neighbor rule

## Scope (files this phase may create/modify)
- game/entities.ts
- game/common.ts

## Requirements
See requirements.md §3.1, §3.2.

## Acceptance criteria
- Neighbor rule matches exactly one attribute.

## Manual test checklist

## Depends on
- None (first phase).
"""


def _write(tmp_path: Path, name: str, content: str) -> Path:
    path = tmp_path / name
    path.write_text(content, encoding="utf-8")
    return path


def test_parses_all_sections(tmp_path: Path) -> None:
    path = _write(tmp_path, "03-move-engine.md", SAMPLE)

    spec = parse_phase_file(path)

    assert spec.number == 3
    assert spec.name == "puzzle-unfolding-move-engine"
    assert spec.scope_globs == [
        "game/gameBuilder.ts",
        "game/__tests__/gameBuilder.test.ts",
    ]
    assert "unfoldGame" in spec.requirements_excerpt
    assert spec.acceptance_criteria == [
        "`unfoldGame` stops when no locked cells remain.",
        "`placePiece` throws on invalid moves when the preference is enabled.",
        "`undoPlay` restores the piece to the tray.",
    ]
    assert spec.manual_test_checklist == ["N/A (unit-test only)"]
    assert spec.depends_on == [2]
    assert spec.source_path == path


def test_branch_name_and_pr_title(tmp_path: Path) -> None:
    path = _write(tmp_path, "03-move-engine.md", SAMPLE)
    spec = parse_phase_file(path)

    assert spec.branch_name == "phase-03-puzzle-unfolding-move-engine"
    assert spec.pr_title == "Phase 3: puzzle-unfolding-move-engine"
    assert "unfoldGame" in spec.pr_body


def test_empty_manual_test_checklist_is_allowed(tmp_path: Path) -> None:
    path = _write(tmp_path, "01-domain-core.md", NO_UI_SAMPLE)
    spec = parse_phase_file(path)

    assert spec.manual_test_checklist == []
    assert spec.depends_on == []


def test_missing_scope_section_raises(tmp_path: Path) -> None:
    content = SAMPLE.replace(
        "## Scope (files this phase may create/modify)", "## Files touched"
    )
    path = _write(tmp_path, "bad.md", content)

    with pytest.raises(ValueError, match="Scope"):
        parse_phase_file(path)


def test_empty_scope_bullets_raises(tmp_path: Path) -> None:
    content = SAMPLE.replace(
        "- game/gameBuilder.ts\n- game/__tests__/gameBuilder.test.ts\n", ""
    )
    path = _write(tmp_path, "bad.md", content)

    with pytest.raises(ValueError, match="Scope"):
        parse_phase_file(path)


def test_malformed_title_raises(tmp_path: Path) -> None:
    content = SAMPLE.replace("# Phase 3 — Puzzle unfolding & move engine", "# Not a phase title")
    path = _write(tmp_path, "bad.md", content)

    with pytest.raises(ValueError, match="Phase NN"):
        parse_phase_file(path)


def test_empty_file_raises(tmp_path: Path) -> None:
    path = _write(tmp_path, "empty.md", "")
    with pytest.raises(ValueError, match="empty"):
        parse_phase_file(path)
