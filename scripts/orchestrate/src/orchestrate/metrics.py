from __future__ import annotations

from pathlib import Path

from pydantic import TypeAdapter

from orchestrate import git_ops
from orchestrate.models import PhaseMetrics

_METRICS_LIST_ADAPTER = TypeAdapter(list[PhaseMetrics])

_MD_HEADER = (
    "| Track | Phase | PR | Sonar opened/resolved/open | LensFlow issues | "
    "Address cycles | Open→merge | Diff (files/+/-) | Escalations | Manual test |\n"
    "|---|---|---|---|---|---|---|---|---|---|\n"
)


def load_all(experiment_log_json: Path) -> list[PhaseMetrics]:
    if not experiment_log_json.exists():
        return []
    return _METRICS_LIST_ADAPTER.validate_json(
        experiment_log_json.read_text(encoding="utf-8")
    )


def _render_row(m: PhaseMetrics) -> str:
    open_to_merge = (
        f"{m.pr_open_to_merge_seconds:.0f}s"
        if m.pr_open_to_merge_seconds is not None
        else "-"
    )
    lensflow = "-" if m.lensflow_attributable_issues is None else str(m.lensflow_attributable_issues)
    manual = (
        "-"
        if m.manual_test_first_try_pass is None
        else ("pass" if m.manual_test_first_try_pass else "fail")
    )
    return (
        f"| {m.track} | {m.phase_number}: {m.phase_name} | "
        f"{f'#{m.pr_number}' if m.pr_number else '-'} | "
        f"{m.sonar_issues_opened}/{m.sonar_issues_resolved}/{m.sonar_issues_left_open} | "
        f"{lensflow} | {m.address_comments_cycles} | {open_to_merge} | "
        f"{m.pr_diff_files}/+{m.pr_diff_lines_added}/-{m.pr_diff_lines_removed} | "
        f"{m.human_escalations} | {manual} |"
    )


def _render_markdown(all_metrics: list[PhaseMetrics]) -> str:
    rows = "\n".join(_render_row(m) for m in all_metrics)
    return "# Experiment log\n\n" + _MD_HEADER + rows + ("\n" if rows else "")


def render(experiment_log_json: Path, experiment_log_md: Path) -> None:
    """Regenerate the Markdown render from the JSON source of truth. Never
    hand-edit experiment-log.md — it's generated, on demand via `orchestrate
    report` or after every phase, per implementation-plan.md §4.7's 'current
    every phase, not retroactively' requirement."""
    all_metrics = load_all(experiment_log_json)
    experiment_log_md.write_text(_render_markdown(all_metrics), encoding="utf-8")


def append_and_commit(
    review_clone: Path,
    experiment_log_json: Path,
    experiment_log_md: Path,
    metrics: PhaseMetrics,
    *,
    base_branch: str = "main",
) -> None:
    """Step 8's final action: append `metrics` to docs/experiment-log.json
    (append-only, source of truth), regenerate the .md render, and commit
    both directly to `base_branch` — several fields (merge timestamp, diff
    stats) aren't knowable until after merge, so this can't happen on the
    phase branch itself."""
    git_ops.fetch_resync(review_clone, base_branch)
    all_metrics = load_all(experiment_log_json)
    all_metrics.append(metrics)
    experiment_log_json.parent.mkdir(parents=True, exist_ok=True)
    experiment_log_json.write_bytes(
        _METRICS_LIST_ADAPTER.dump_json(all_metrics, indent=2) + b"\n"
    )
    render(experiment_log_json, experiment_log_md)
    committed = git_ops.commit_all(
        review_clone,
        f"Record Phase {metrics.phase_number} ({metrics.phase_name}) experiment metrics",
    )
    if committed:
        git_ops.fast_forward_push(review_clone, base_branch)
