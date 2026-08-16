from __future__ import annotations

from typing import ClassVar


class CommandError(RuntimeError):
    """A subprocess (git/gh/vibe-heal/harness) exited non-zero. Base for the
    per-tool wrapper modules' own *CommandError classes, so each only needs
    to subclass — not reimplement — the args/returncode/stderr bookkeeping
    and message format."""

    def __init__(self, args: list[str], returncode: int, stderr: str) -> None:
        self.args_ = args
        self.returncode = returncode
        self.stderr = stderr
        super().__init__(f"`{' '.join(args)}` exited {returncode}: {stderr.strip()}")


class OrchestrationError(Exception):
    """Base for every escalation raised out of the 8-step phase workflow.

    Every subclass carries enough context (track/phase/PR, cause, and a
    concrete next command) for phase_runner's outer handler to print a report
    a human can act on without re-deriving what happened — see the
    "Escalation UX" section of the plan: nothing merges and nothing advances
    to the next phase when one of these is raised.

    `track`/`phase_number`/`phase_name` start unset here (phase_runner raises
    without knowing "which phase in a track") and are filled in via
    `with_context()` by whichever caller does know — track_runner for a solo
    track, lockstep_runner for `track` too — so cli.py can always read them
    off the exception itself rather than via a `getattr(..., None)` guess.
    """

    exit_code: ClassVar[int] = 1

    def __init__(self, message: str, *, next_command: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.next_command = next_command
        self.track: str | None = None
        self.phase_number: int | None = None
        self.phase_name: str | None = None

    def with_context(
        self,
        *,
        track: str | None = None,
        phase_number: int | None = None,
        phase_name: str | None = None,
    ) -> "OrchestrationError":
        if track is not None:
            self.track = track
        if phase_number is not None:
            self.phase_number = phase_number
        if phase_name is not None:
            self.phase_name = phase_name
        return self


class EmptyImplementationError(OrchestrationError):
    """opencode left the working tree unchanged — refuse to open an empty PR."""

    exit_code = 10


class ScopeViolation(OrchestrationError):
    """The diff touches files outside the phase's declared scope globs."""

    exit_code = 11

    def __init__(self, offending_files: list[str], allowed_globs: list[str]) -> None:
        self.offending_files = offending_files
        self.allowed_globs = allowed_globs
        files = ", ".join(offending_files)
        globs = ", ".join(allowed_globs)
        super().__init__(
            f"diff touches files outside declared scope: {files} (allowed: {globs})",
            next_command="git diff --name-only origin/main...HEAD",
        )


class MergeGateFailure(OrchestrationError):
    """A hard merge gate (pnpm build/lint/test) failed. Does not consume or
    repeat the review retry budget — a different failure class from review
    feedback."""

    exit_code = 12

    def __init__(self, gate_name: str, output_tail: str) -> None:
        self.gate_name = gate_name
        self.output_tail = output_tail
        super().__init__(
            f"merge gate '{gate_name}' failed",
            next_command=f"re-run `pnpm {gate_name}` in the review clone to reproduce",
        )


class RetryBudgetExhausted(OrchestrationError):
    """steps 3-5 stayed unclean through the max_cycles cap. The PR is left
    open, not merged, not closed."""

    exit_code = 13

    def __init__(self, cycles: int, pr_url: str | None, unresolved_thread_count: int) -> None:
        self.cycles = cycles
        self.pr_url = pr_url
        self.unresolved_thread_count = unresolved_thread_count
        super().__init__(
            f"{unresolved_thread_count} unresolved review thread(s) remain after "
            f"{cycles} cycle(s)",
            next_command=f"review remaining threads by hand: {pr_url or '<pr-url>'}",
        )


class ManualTestFailed(OrchestrationError):
    """The human reviewer declined the manual test checklist and did not opt
    into another review cycle."""

    exit_code = 14

    def __init__(self, notes: str | None = None) -> None:
        self.notes = notes
        super().__init__(
            "manual test checklist failed" + (f": {notes}" if notes else ""),
        )
