from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, field_validator

HARNESS_TOOL_DIR = Path("~/.harness/tools/pr-review").expanduser()
VIBE_HEAL_TOOL_DIR = Path("~/development/vibe-heal").expanduser()


class TrackConfig(BaseModel):
    """Everything orchestrate needs to know about one track repo (baseline or
    lensflow). Assumes the repo already exists, is bootstrapped from this
    template, and has a working .harness.toml (Phase 0 bootstrap is out of
    scope for this script — implementation-plan.md §3)."""

    track: str
    repo_slug: str  # "owner/repo" — used for gh --repo and the graphql query
    impl_clone: Path
    review_clone: Path
    harness_config: Path
    vibe_heal_env_file: Path
    docs_phases_dir: Path | None = None
    base_branch: str = "main"
    max_cycles: int = 3

    @field_validator("repo_slug")
    @classmethod
    def validate_repo_slug(cls, v: str) -> str:
        if "/" not in v:
            raise ValueError(f"repo_slug must be in 'owner/repo' format, got: {v!r}")
        return v

    @property
    def owner(self) -> str:
        return self.repo_slug.split("/", 1)[0]

    @property
    def repo(self) -> str:
        return self.repo_slug.split("/", 1)[1]

    @property
    def phases_dir(self) -> Path:
        return self.docs_phases_dir or (self.review_clone / "docs" / "phases")

    @property
    def experiment_log_json(self) -> Path:
        return self.review_clone / "docs" / "experiment-log.json"

    @property
    def experiment_log_md(self) -> Path:
        return self.review_clone / "docs" / "experiment-log.md"
