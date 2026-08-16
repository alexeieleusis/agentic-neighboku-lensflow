from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from orchestrate.config import TrackConfig
from orchestrate.errors import OrchestrationError
from orchestrate.lockstep_runner import run_lockstep as _run_lockstep
from orchestrate.metrics import load_all as _load_metrics
from orchestrate.metrics import render as render_experiment_log
from orchestrate.models import PhaseMetrics
from orchestrate.phase_file import parse_phase_file
from orchestrate.phase_runner import run_phase as _run_phase
from orchestrate.track_runner import discover_phase_files as _discover_phase_files
from orchestrate.track_runner import run_track as _run_track

app = typer.Typer(
    add_completion=False,
    help="Drive the Neighboku AI-rebuild's per-phase workflow "
    "(implementation-plan.md §2) against opencode/gh/vibe-heal/harness.",
)
console = Console()

_DEFAULT_STATE_DIR = Path.home() / ".orchestrate-state"


def _track_config(
    *,
    track: str,
    repo: str,
    impl_clone: Path,
    review_clone: Path,
    harness_config: Path,
    vibe_heal_env_file: Path,
    base_branch: str,
    max_cycles: int,
) -> TrackConfig:
    return TrackConfig(
        track=track,
        repo_slug=repo,
        impl_clone=impl_clone,
        review_clone=review_clone,
        harness_config=harness_config,
        vibe_heal_env_file=vibe_heal_env_file,
        base_branch=base_branch,
        max_cycles=max_cycles,
    )


def _print_escalation(
    track: str, phase_number: int | None, phase_name: str | None, error: OrchestrationError
) -> None:
    body = f"[bold]{error.message}[/bold]"
    if error.next_command:
        body += f"\n\n[dim]Next:[/dim] {error.next_command}"
    console.print(
        Panel(
            body,
            title=f"Escalation — {track} / Phase {phase_number}: {phase_name}",
            border_style="red",
        )
    )


def _print_result(track: str, phase_number: int, phase_name: str, result) -> None:
    status = "merged" if result.merged else "ready (not merged — pass --auto-merge to merge)"
    m = result.metrics
    console.print(
        Panel(
            f"PR #{m.pr_number}: {m.pr_url}\n"
            f"Sonar: {m.sonar_issues_opened} opened / {m.sonar_issues_resolved} resolved / "
            f"{m.sonar_issues_left_open} left open\n"
            f"Address-comments cycles: {m.address_comments_cycles}\n"
            f"Diff: {m.pr_diff_files} files, +{m.pr_diff_lines_added}/-{m.pr_diff_lines_removed}",
            title=f"{track} / Phase {phase_number}: {phase_name} — {status}",
            border_style="green",
        )
    )


@app.command("run-phase")
def run_phase_command(
    phase_file: Path = typer.Option(
        ..., exists=True, dir_okay=False, help="Path to docs/phases/NN-name.md"
    ),
    track: str = typer.Option(..., help="Track label, e.g. baseline or lensflow"),
    repo: str = typer.Option(..., help="owner/repo slug, e.g. acme/neighboku-ai-baseline"),
    impl_clone: Path = typer.Option(..., help="Local clone opencode implements/commits into"),
    review_clone: Path = typer.Option(
        ..., help="Local clone that harness/vibe-heal target — never committed into directly"
    ),
    harness_config: Path = typer.Option(..., help="Path to that repo's .harness.toml"),
    vibe_heal_env_file: Path = typer.Option(..., help="Path to .env.vibeheal for that repo"),
    base_branch: str = typer.Option("main"),
    max_cycles: int = typer.Option(3, min=1, help="Retry cap for steps 3-5 (implementation-plan.md §4.2)"),
    auto_merge: bool = typer.Option(
        True, help="Merge automatically once steps 3-7 are clean"
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Stub every external call (opencode/gh/vibe-heal/harness) — "
        "validates branch/commit/scope/retry control flow only",
    ),
    resume: bool = typer.Option(
        False, help="Resume from an existing PR if one was already opened for this phase"
    ),
) -> None:
    """Run the full 8-step workflow for one phase on one track (Stage A)."""
    phase = parse_phase_file(phase_file)
    track_config = _track_config(
        track=track,
        repo=repo,
        impl_clone=impl_clone,
        review_clone=review_clone,
        harness_config=harness_config,
        vibe_heal_env_file=vibe_heal_env_file,
        base_branch=base_branch,
        max_cycles=max_cycles,
    )

    try:
        result = _run_phase(
            track_config,
            phase,
            auto_merge=auto_merge,
            dry_run=dry_run,
            resume=resume,
            state_dir=_DEFAULT_STATE_DIR,
        )
    except OrchestrationError as error:
        _print_escalation(track, phase.number, phase.name, error)
        raise typer.Exit(code=error.exit_code) from error

    _print_result(track, phase.number, phase.name, result)


@app.command("run-track")
def run_track_command(
    track: str = typer.Option(..., help="Track label, e.g. baseline or lensflow"),
    repo: str = typer.Option(..., help="owner/repo slug, e.g. acme/neighboku-ai-baseline"),
    impl_clone: Path = typer.Option(..., help="Local clone opencode implements/commits into"),
    review_clone: Path = typer.Option(
        ..., help="Local clone that harness/vibe-heal target — must contain docs/phases/"
    ),
    harness_config: Path = typer.Option(..., help="Path to that repo's .harness.toml"),
    vibe_heal_env_file: Path = typer.Option(..., help="Path to .env.vibeheal for that repo"),
    base_branch: str = typer.Option("main"),
    max_cycles: int = typer.Option(3, min=1),
    start_phase: int | None = typer.Option(None, help="Skip phases numbered below this"),
    stop_phase: int | None = typer.Option(None, help="Stop after this phase number"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    resume: bool = typer.Option(False),
) -> None:
    """Loop docs/phases/*.md in order for one track, skipping already-merged
    phases, halting on the first escalation (Stage B)."""
    track_config = _track_config(
        track=track,
        repo=repo,
        impl_clone=impl_clone,
        review_clone=review_clone,
        harness_config=harness_config,
        vibe_heal_env_file=vibe_heal_env_file,
        base_branch=base_branch,
        max_cycles=max_cycles,
    )

    try:
        results = _run_track(
            track_config,
            start_phase=start_phase,
            stop_phase=stop_phase,
            dry_run=dry_run,
            resume=resume,
            state_dir=_DEFAULT_STATE_DIR,
        )
    except OrchestrationError as error:
        # track_runner annotates the escalating phase onto the exception
        # before re-raising (it's the only layer that knows "which phase in
        # this track", phase_runner itself doesn't).
        _print_escalation(track, error.phase_number, error.phase_name, error)
        raise typer.Exit(code=error.exit_code) from error

    for result in results:
        _print_result(track, result.metrics.phase_number, result.metrics.phase_name, result)
    console.print(f"[green]{len(results)} phase(s) completed on track '{track}'.[/green]")


@app.command("run-lockstep")
def run_lockstep_command(
    baseline_repo: str = typer.Option(..., help="owner/repo slug for the baseline track"),
    baseline_impl_clone: Path = typer.Option(...),
    baseline_review_clone: Path = typer.Option(...),
    baseline_harness_config: Path = typer.Option(...),
    baseline_vibe_heal_env_file: Path = typer.Option(...),
    lensflow_repo: str = typer.Option(..., help="owner/repo slug for the lensflow track"),
    lensflow_impl_clone: Path = typer.Option(...),
    lensflow_review_clone: Path = typer.Option(...),
    lensflow_harness_config: Path = typer.Option(...),
    lensflow_vibe_heal_env_file: Path = typer.Option(...),
    base_branch: str = typer.Option("main"),
    max_cycles: int = typer.Option(3, min=1),
    start_phase: int | None = typer.Option(None),
    stop_phase: int | None = typer.Option(None),
    dry_run: bool = typer.Option(False, "--dry-run"),
    resume: bool = typer.Option(False),
) -> None:
    """For each phase N, finish N on baseline then N on lensflow before
    moving to N+1 on either (implementation-plan.md §1.3, Stage C)."""
    baseline = _track_config(
        track="baseline",
        repo=baseline_repo,
        impl_clone=baseline_impl_clone,
        review_clone=baseline_review_clone,
        harness_config=baseline_harness_config,
        vibe_heal_env_file=baseline_vibe_heal_env_file,
        base_branch=base_branch,
        max_cycles=max_cycles,
    )
    lensflow = _track_config(
        track="lensflow",
        repo=lensflow_repo,
        impl_clone=lensflow_impl_clone,
        review_clone=lensflow_review_clone,
        harness_config=lensflow_harness_config,
        vibe_heal_env_file=lensflow_vibe_heal_env_file,
        base_branch=base_branch,
        max_cycles=max_cycles,
    )

    try:
        results = _run_lockstep(
            baseline,
            lensflow,
            start_phase=start_phase,
            stop_phase=stop_phase,
            dry_run=dry_run,
            resume=resume,
            state_dir=_DEFAULT_STATE_DIR,
        )
    except OrchestrationError as error:
        _print_escalation(error.track or "?", error.phase_number, error.phase_name, error)
        raise typer.Exit(code=error.exit_code) from error

    for track_name, track_results in results.items():
        for result in track_results:
            _print_result(track_name, result.metrics.phase_number, result.metrics.phase_name, result)
    parts = [f"{len(track_results)} phase(s) on {track_name}" for track_name, track_results in results.items()]
    console.print(f"[green]Lockstep complete: {', '.join(parts)}.[/green]")


@app.command("status")
def status_command(
    track: str = typer.Option(..., help="Track label, for the table title"),
    review_clone: Path = typer.Option(
        ..., help="Track's local clone (reads docs/phases/ and docs/experiment-log.json)"
    ),
) -> None:
    """Per-track phase-completion table."""
    phases_dir = review_clone / "docs" / "phases"
    log_json = review_clone / "docs" / "experiment-log.json"

    latest_by_phase: dict[int, PhaseMetrics] = {}
    for m in _load_metrics(log_json):
        # A phase can appear more than once (an escalation followed by a
        # later successful resume) — the last entry wins.
        latest_by_phase[m.phase_number] = m

    table = Table(title=f"Track: {track}")
    table.add_column("Phase")
    table.add_column("Name")
    table.add_column("Status")
    table.add_column("Cycles")
    table.add_column("Escalations")

    for phase_file in _discover_phase_files(phases_dir):
        phase = parse_phase_file(phase_file)
        m = latest_by_phase.get(phase.number)
        if m is None:
            table.add_row(str(phase.number), phase.name, "pending", "-", "-")
        else:
            if m.pr_merged_at is not None:
                status = "merged"
            elif m.human_escalations > 0:
                status = "escalated"
            else:
                status = "in progress"
            table.add_row(
                str(phase.number),
                phase.name,
                status,
                str(m.address_comments_cycles),
                str(m.human_escalations),
            )

    console.print(table)


@app.command("report")
def report_command(
    review_clone: Path = typer.Option(...),
) -> None:
    """Regenerate docs/experiment-log.md from docs/experiment-log.json."""
    log_json = review_clone / "docs" / "experiment-log.json"
    log_md = review_clone / "docs" / "experiment-log.md"
    render_experiment_log(log_json, log_md)
    console.print(f"[green]Regenerated[/green] {log_md}")


if __name__ == "__main__":
    app()
