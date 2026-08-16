from __future__ import annotations

import re
from pathlib import Path

from orchestrate.models import PhaseSpec

# Matches the fixed phase-file format from implementation-plan.md §5:
#   # Phase NN — <name>
_TITLE_RE = re.compile(r"^#\s*Phase\s+(\d+)\s*[—-]\s*(.+?)\s*$", re.IGNORECASE)
_SECTION_RE = re.compile(r"^##\s+(.+?)\s*$")
_PHASE_NUMBER_RE = re.compile(r"Phase\s+(\d+)", re.IGNORECASE)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _split_sections(body: str) -> dict[str, str]:
    """Split everything after the title line into {heading: body} by '## '
    headings, preserving section order via dict insertion order."""
    sections: dict[str, str] = {}
    current_key: str | None = None
    current_lines: list[str] = []
    for line in body.splitlines():
        match = _SECTION_RE.match(line)
        if match:
            if current_key is not None:
                sections[current_key] = "\n".join(current_lines).strip()
            current_key = match.group(1).strip()
            current_lines = []
        elif current_key is not None:
            current_lines.append(line)
    if current_key is not None:
        sections[current_key] = "\n".join(current_lines).strip()
    return sections


def _find_section(sections: dict[str, str], prefix: str, *, path: Path) -> str:
    prefix_lower = prefix.lower()
    for key, value in sections.items():
        if key.lower().startswith(prefix_lower):
            return value
    raise ValueError(f"{path}: missing a '## {prefix}' section")


def _bullet_items(text: str) -> list[str]:
    items: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("- "):
            items.append(stripped[2:].strip())
    return items


def parse_phase_file(path: Path) -> PhaseSpec:
    """Parse a docs/phases/NN-name.md file into a PhaseSpec.

    Manual test checklist may legitimately be empty (Phases 1-3 in the plan
    have no UI — "N/A, unit-test only"); Scope and Acceptance criteria may
    not, since those two drive the scope guard and the PR body.
    """
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines:
        raise ValueError(f"{path}: empty phase file")

    title_match = _TITLE_RE.match(lines[0])
    if not title_match:
        raise ValueError(
            f"{path}: first line must match '# Phase NN — <name>', got: {lines[0]!r}"
        )
    number = int(title_match.group(1))
    name = _slug(title_match.group(2))

    sections = _split_sections("\n".join(lines[1:]))

    scope_globs = _bullet_items(_find_section(sections, "Scope", path=path))
    if not scope_globs:
        raise ValueError(f"{path}: '## Scope' section has no bullet items")

    requirements_excerpt = _find_section(sections, "Requirements", path=path)

    acceptance_criteria = _bullet_items(
        _find_section(sections, "Acceptance criteria", path=path)
    )
    if not acceptance_criteria:
        raise ValueError(f"{path}: '## Acceptance criteria' section has no bullet items")

    manual_test_checklist = _bullet_items(
        _find_section(sections, "Manual test checklist", path=path)
    )

    depends_on_text = _find_section(sections, "Depends on", path=path)
    depends_on = [int(m.group(1)) for m in _PHASE_NUMBER_RE.finditer(depends_on_text)]

    return PhaseSpec(
        number=number,
        name=name,
        scope_globs=scope_globs,
        requirements_excerpt=requirements_excerpt,
        acceptance_criteria=acceptance_criteria,
        manual_test_checklist=manual_test_checklist,
        depends_on=depends_on,
        source_path=path,
    )
