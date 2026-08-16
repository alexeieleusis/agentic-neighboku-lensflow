from __future__ import annotations

import typer
from rich.console import Console
from rich.panel import Panel

from orchestrate.errors import ManualTestFailed

console = Console()


def prompt(phase_number: int, phase_name: str, checklist: list[str]) -> bool:
    """Step 7: prints the phase's manual test checklist and blocks on a
    human pass/fail decision — this cannot be automated. Returns True on
    pass, or False if the human declines but explicitly opts into spending
    one more review cycle (the caller decrements the retry budget for that);
    raises ManualTestFailed if the human declines and does not opt in — the
    script never loops on a failed manual test automatically."""
    if not checklist:
        console.print(
            f"[dim]Phase {phase_number} ({phase_name}) has no manual test checklist "
            "(unit-test only) — skipping.[/dim]"
        )
        return True

    body = "\n".join(f"- {item}" for item in checklist)
    console.print(
        Panel(
            body,
            title=f"Manual test checklist — Phase {phase_number}: {phase_name}",
            subtitle="run `pnpm dev` and walk through each item",
        )
    )
    passed = typer.confirm("Did every item pass?", default=False)
    if passed:
        return True

    notes = typer.prompt("What failed? (notes for the escalation log)", default="")
    retry = typer.confirm(
        "Spend one more review cycle and retry, instead of escalating now?",
        default=False,
    )
    if retry:
        return False
    raise ManualTestFailed(notes or None)
