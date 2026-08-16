import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from orchestrate import merge_gates
from orchestrate.errors import MergeGateFailure


def _completed(returncode: int = 0, stdout: str = "", stderr: str = "") -> MagicMock:
    proc = MagicMock(spec=subprocess.CompletedProcess)
    proc.returncode = returncode
    proc.stdout = stdout
    proc.stderr = stderr
    return proc


def test_runs_all_four_gates_in_order_when_all_pass(mocker) -> None:
    run = mocker.patch(
        "orchestrate.merge_gates.subprocess.run", return_value=_completed()
    )

    merge_gates.run(Path("/review-clone"))

    assert run.call_count == 4
    commands = [call.args[0] for call in run.call_args_list]
    assert commands == [
        ["pnpm", "install", "--frozen-lockfile"],
        ["pnpm", "build"],
        ["pnpm", "lint"],
        ["pnpm", "test", "run"],
    ]
    for call in run.call_args_list:
        assert call.kwargs["cwd"] == Path("/review-clone")


def test_stops_at_first_failing_gate(mocker) -> None:
    run = mocker.patch(
        "orchestrate.merge_gates.subprocess.run",
        side_effect=[_completed(), _completed(returncode=1, stderr="type error in Foo.tsx")],
    )

    with pytest.raises(MergeGateFailure) as excinfo:
        merge_gates.run(Path("/review-clone"))

    assert run.call_count == 2  # install, build — lint/test never ran
    assert excinfo.value.gate_name == "build"
    assert "type error in Foo.tsx" in excinfo.value.output_tail


def test_output_tail_is_truncated(mocker) -> None:
    long_output = "\n".join(f"line {i}" for i in range(200))
    mocker.patch(
        "orchestrate.merge_gates.subprocess.run",
        return_value=_completed(returncode=1, stdout=long_output),
    )

    with pytest.raises(MergeGateFailure) as excinfo:
        merge_gates.run(Path("/review-clone"))

    tail_lines = excinfo.value.output_tail.splitlines()
    assert len(tail_lines) == merge_gates._TAIL_LINES
    assert tail_lines[-1] == "line 199"


def test_subprocess_run_exception_raises_merge_gate_failure(mocker) -> None:
    mocker.patch(
        "orchestrate.merge_gates.subprocess.run",
        side_effect=FileNotFoundError("No such file or directory: pnpm"),
    )

    with pytest.raises(MergeGateFailure) as excinfo:
        merge_gates.run(Path("/review-clone"))

    assert excinfo.value.gate_name == "install"
    assert "pnpm" in excinfo.value.output_tail
    assert isinstance(excinfo.value.__cause__, FileNotFoundError)
