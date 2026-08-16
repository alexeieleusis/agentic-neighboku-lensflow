from __future__ import annotations

from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, Field


class PhaseSpec(BaseModel):
    """Parsed from a docs/phases/NN-name.md phase task-description file
    (implementation-plan.md §5)."""

    number: int
    name: str
    scope_globs: list[str]
    requirements_excerpt: str
    acceptance_criteria: list[str]
    manual_test_checklist: list[str]
    depends_on: list[int] = Field(default_factory=list)
    source_path: Path

    @property
    def branch_name(self) -> str:
        return f"phase-{self.number:02d}-{self.name}"

    @property
    def pr_title(self) -> str:
        return f"Phase {self.number}: {self.name}"

    @property
    def pr_body(self) -> str:
        return "\n".join(f"- {item}" for item in self.acceptance_criteria)


class VibeHealFingerprint(BaseModel):
    """Identifies one vibe-heal issue across scan cycles. review.json has no
    native cross-run issue id, so (file, rule, line) is the stand-in identity —
    restricted by convention to on_changed_line=True issues, the only ones
    vibe-heal actually posts."""

    file: str
    rule: str
    line: int

    def key(self) -> tuple[str, str, int]:
        return (self.file, self.rule, self.line)


class RetryCycleState(BaseModel):
    """In-memory state for one run-phase invocation's iterate loop (steps 3-5)."""

    cycle_index: int = 0
    posted_vibe_heal_fingerprints: set[tuple[str, str, int]] = Field(default_factory=set)
    unresolved_thread_count: int | None = None


class ResumeState(BaseModel):
    """Persisted immediately after step 2 (PR opened) so a crashed run can
    pick back up with `run-phase --resume` instead of re-implementing from
    scratch or opening a second PR for the same phase."""

    number: int
    url: str
    pr_opened_at: datetime


class PhaseMetrics(BaseModel):
    """Per-phase, per-track metrics — the exact field list from
    implementation-plan.md §1.4."""

    track: str
    phase_number: int
    phase_name: str
    pr_number: int | None = None
    pr_url: str | None = None
    sonar_issues_opened: int = 0
    sonar_issues_resolved: int = 0
    sonar_issues_left_open: int = 0
    lensflow_attributable_issues: int | None = None
    address_comments_cycles: int = 0
    pr_opened_at: datetime | None = None
    pr_merged_at: datetime | None = None
    pr_diff_files: int = 0
    pr_diff_lines_added: int = 0
    pr_diff_lines_removed: int = 0
    human_escalations: int = 0
    manual_test_first_try_pass: bool | None = None
    escalation_reason: str | None = None

    @property
    def pr_open_to_merge_seconds(self) -> float | None:
        if self.pr_opened_at is None or self.pr_merged_at is None:
            return None
        return (self.pr_merged_at - self.pr_opened_at).total_seconds()
