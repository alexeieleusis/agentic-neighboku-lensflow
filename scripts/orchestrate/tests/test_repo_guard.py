import subprocess

import pytest
from orchestrate.repo_guard import RepoIdentityError, assert_repo_identity


def _init_repo(path, origin_url):
    subprocess.run(["git", "init", "-q", str(path)], check=True)
    subprocess.run(["git", "-C", str(path), "remote", "add", "origin", origin_url], check=True)


def test_passes_when_toplevel_and_origin_match(tmp_path):
    _init_repo(tmp_path, "git@github.com:acme/neighboku-ai-baseline.git")
    assert_repo_identity(tmp_path, "acme/neighboku-ai-baseline")


@pytest.mark.parametrize(
    "origin_url",
    [
        "git@github.com:acme/neighboku-ai-baseline.git",
        "git@github.com:acme/neighboku-ai-baseline",
        "https://github.com/acme/neighboku-ai-baseline.git",
        "https://github.com/acme/neighboku-ai-baseline",
        "ssh://git@github.com/acme/neighboku-ai-baseline.git",
    ],
)
def test_matches_across_url_forms(tmp_path, origin_url):
    _init_repo(tmp_path, origin_url)
    assert_repo_identity(tmp_path, "acme/neighboku-ai-baseline")


def test_raises_on_mismatched_origin(tmp_path):
    _init_repo(tmp_path, "git@github.com:alexeieleusis/dotharness.git")
    with pytest.raises(RepoIdentityError, match="does not match"):
        assert_repo_identity(tmp_path, "acme/neighboku-ai-baseline")


def test_raises_when_working_dir_is_not_a_git_repo(tmp_path):
    with pytest.raises(RepoIdentityError, match="not inside a git repository"):
        assert_repo_identity(tmp_path, "acme/neighboku-ai-baseline")


def test_raises_when_working_dir_is_a_subdirectory_of_a_repo(tmp_path):
    _init_repo(tmp_path, "git@github.com:acme/neighboku-ai-baseline.git")
    subdir = tmp_path / "packages" / "web"
    subdir.mkdir(parents=True)
    with pytest.raises(RepoIdentityError, match="not itself the toplevel"):
        assert_repo_identity(subdir, "acme/neighboku-ai-baseline")


def test_raises_when_origin_remote_is_missing(tmp_path):
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    with pytest.raises(RepoIdentityError, match="no 'origin' remote"):
        assert_repo_identity(tmp_path, "acme/neighboku-ai-baseline")
