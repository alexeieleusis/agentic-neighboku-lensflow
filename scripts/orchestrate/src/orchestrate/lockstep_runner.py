from __future__ import annotations

from pathlib import Path

from orchestrate.config import TrackConfig
from orchestrate.errors import OrchestrationError
from orchestrate.phase_file import parse_phase_file
from orchestrate.phase_runner import PhaseRunResult
from orchestrate.phase_runner import run_phase as _run_phase
from orchestrate.track_runner import already_merged_phase_numbers, discover_phase_files, in_range


def run_lockstep(
    baseline: TrackConfig,
    lensflow: TrackConfig,
    *,
    start_phase: int | None = None,
    stop_phase: int | None = None,
    dry_run: bool = False,
    resume: bool = False,
    state_dir: Path | None = None,
) -> dict[str, list[PhaseRunResult]]:
    """Stage C: for each phase N in order, finish N on baseline, then N on
    lensflow, before moving to N+1 on either — implementation-plan.md §1.3.
    Sequential by design (no concurrency needed for v1 correctness); halts
    both tracks entirely the moment either escalates on any phase.

    Phase discovery/ordering is driven by `baseline.phases_dir` — the plan's
    comparison-hygiene requirement (§4.7) is that phase files are copied
    byte-identical into both repos, so each track's own copy under its own
    phases_dir is what actually gets parsed and run for that track; a
    missing copy on one track is treated as a hygiene violation, not
    silently patched over by reusing the other track's file.
    """
    results: dict[str, list[PhaseRunResult]] = {baseline.track: [], lensflow.track: []}
    merged_by_track = {
        baseline.track: already_merged_phase_numbers(baseline),
        lensflow.track: already_merged_phase_numbers(lensflow),
    }

    for phase_file in discover_phase_files(baseline.phases_dir):
        phase_number_hint = parse_phase_file(phase_file).number
        if not in_range(phase_number_hint, start_phase, stop_phase):
            continue

        for track in (baseline, lensflow):
            if phase_number_hint in merged_by_track[track.track]:
                continue
            track_phase_file = track.phases_dir / phase_file.name
            if not track_phase_file.exists():
                raise RuntimeError(
                    f"comparison hygiene violation: {track.repo_slug} is missing "
                    f"{phase_file.name} (present on {baseline.repo_slug}) — phase "
                    "files must be copied byte-identical to both tracks (§4.7)"
                )
            phase = parse_phase_file(track_phase_file)
            try:
                result = _run_phase(
                    track, phase, dry_run=dry_run, resume=resume, state_dir=state_dir
                )
            except OrchestrationError as error:
                error.with_context(
                    track=track.track, phase_number=phase.number, phase_name=phase.name
                )
                raise
            results[track.track].append(result)

    return results
