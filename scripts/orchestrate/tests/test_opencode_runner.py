import re
import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from orchestrate import opencode_runner

TMP_PATH_RE = re.compile(r"Read (\S+) and follow the instructions exactly\.")


def _completed(returncode: int = 0, stdout: str = "", stderr: str = "") -> MagicMock:
    proc = MagicMock(spec=subprocess.CompletedProcess)
    proc.returncode = returncode
    proc.stdout = stdout
    proc.stderr = stderr
    return proc


def test_writes_prompt_to_temp_file_and_never_passes_it_inline(mocker) -> None:
    seen_prompt = {}

    def fake_run(args, **kwargs):
        message = args[2]
        match = TMP_PATH_RE.match(message)
        assert match, f"unexpected message shape: {message!r}"
        tmp_path = Path(match.group(1))
        seen_prompt["content"] = tmp_path.read_text()
        seen_prompt["path"] = tmp_path
        return _completed(stdout="done")

    mocker.patch("orchestrate.opencode_runner.subprocess.run", side_effect=fake_run)

    output = opencode_runner.run(Path("/impl-clone"), "do the phase 1 work")

    assert output == "done"
    assert seen_prompt["content"] == "do the phase 1 work"
    # the temp file is cleaned up after the call
    assert not seen_prompt["path"].exists()


def test_uses_real_confirmed_flags_not_dangerously_skip_permissions(mocker) -> None:
    run = mocker.patch(
        "orchestrate.opencode_runner.subprocess.run", return_value=_completed()
    )

    opencode_runner.run(Path("/impl-clone"), "prompt text")

    args = run.call_args.args[0]
    assert args[0] == "opencode"
    assert args[1] == "run"
    assert "--pure" in args
    assert "--dir" in args
    assert str(Path("/impl-clone")) in args
    assert "--dangerously-skip-permissions" not in args


def test_raises_on_nonzero_exit(mocker) -> None:
    mocker.patch(
        "orchestrate.opencode_runner.subprocess.run",
        return_value=_completed(returncode=1, stderr="model unavailable"),
    )

    with pytest.raises(opencode_runner.OpenCodeCommandError, match="model unavailable"):
        opencode_runner.run(Path("/impl-clone"), "prompt text")


def test_cleans_up_temp_file_even_on_failure(mocker) -> None:
    seen_path = {}

    def fake_run(args, **kwargs):
        message = args[2]
        seen_path["path"] = Path(TMP_PATH_RE.match(message).group(1))
        return _completed(returncode=1, stderr="boom")

    mocker.patch("orchestrate.opencode_runner.subprocess.run", side_effect=fake_run)

    with pytest.raises(opencode_runner.OpenCodeCommandError):
        opencode_runner.run(Path("/impl-clone"), "prompt text")

    assert not seen_path["path"].exists()
