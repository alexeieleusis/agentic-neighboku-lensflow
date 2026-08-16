from __future__ import annotations

import re
from pathlib import Path

from orchestrate import metrics
from orchestrate.config import TrackConfig
from orchestrate.errors import OrchestrationError
from orchestrate.phase_file import parse_phase_file
from orchestrate.phase_runner import PhaseRunResult
from orchestrate.phase_runner import run_phase as _run_phase

_PHASE_FILE_RE = re.compile(r"^(\d+)-")


def discover_phase_files(phases_dir: Path) -> list[Path]:
    """docs/phases/NN-name.md files under `phases_dir`, in numeric order."""
    files = [p for p in phases_dir.glob("*.md") if _PHASE_FILE_RE.match(p.name)]
    return sorted(files, key=lambda p: int(_PHASE_FILE_RE.match(p.name).group(1)))


def in_range(number: int, start_phase: int | None, stop_phase: int | None) -> bool:
    """Whether `number` falls within the (inclusive) start/stop bounds a
    run-track/run-lockstep invocation was given, either end optional."""
    if start_phase is not None and number < start_phase:
        return False
    if stop_phase is not None and number > stop_phase:
        return False
    return True


def already_merged_phase_numbers(track: TrackConfig) -> set[int]:
    all_metrics = metrics.load_all(track.experiment_log_json)
    return {m.phase_number for m in all_metrics if m.pr_merged_at is not None}


def run_track(
    track: TrackConfig,
    *,
    start_phase: int | None = None,
    stop_phase: int | None = None,
    dry_run: bool = False,
    resume: bool = False,
    state_dir: Path | None = None,
) -> list[PhaseRunResult]:
    """Stage B: loop docs/phases/*.md in order for one track, skipping
    phases already merged (per experiment-log.json), halting on the first
    escalation. Deliberately does not catch OrchestrationError — it
    propagates to the caller (cli.py), which owns the escalation report and
    exit code, matching phase_runner's own "nothing merges, nothing advances"
    invariant one level up."""
    already_merged = already_merged_phase_numbers(track)
    results: list[PhaseRunResult] = []
    for phase_file in discover_phase_files(track.phases_dir):
        phase = parse_phase_file(phase_file)
        if not in_range(phase.number, start_phase, stop_phase):
            continue
        if phase.number in already_merged:
            continue
        try:
            result = _run_phase(
                track, phase, dry_run=dry_run, resume=resume, state_dir=state_dir
            )
        except OrchestrationError as error:
            # Annotate which phase was in progress — phase_runner itself has
            # no notion of "which phase in a track", only track_runner does.
            error.with_context(phase_number=phase.number, phase_name=phase.name)
            raise
        results.append(result)
    return results
