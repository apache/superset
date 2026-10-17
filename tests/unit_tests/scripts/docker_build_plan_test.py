# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Pins which refs may publish Docker images, and under which tag.

``scripts/docker-build-plan.sh`` is the only thing standing between a branch
push and a published ``apache/superset`` tag. The workflow's push filter
(``"[0-9].[0-9]*"``) is deliberately looser than the release-branch naming rule,
so branches like ``0.36.0-lyft1`` reach the script and must be turned away by it
rather than by the trigger. That classification is wide enough to be worth a
table rather than a handful of shell assertions, which is why it lives here
instead of alongside the command-line assertions in ``docker.yml``.

The scripts are run as subprocesses, exactly as the workflow runs them, so the
``printf %q`` quoting they emit for ``eval`` is exercised too.
"""

import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parents[3]

# Resolved once so the subprocess calls below use an absolute interpreter path.
BASH = shutil.which("bash") or "/bin/bash"

PLAN_SCRIPT = "scripts/docker-build-plan.sh"
FLAGS_SCRIPT = "scripts/docker-build-extra-flags.sh"

# Arbitrary but valid: 40 lowercase hex characters, the shape the plan script
# requires before it will build a tag out of a commit.
SHA = "0123456789abcdef0123456789abcdef01234567"
SHORT_SHA = SHA[:7]

PUBLISHING_REPOSITORY = "apache/superset"
FORK_REPOSITORY = "someone/superset"

MULTI_ARCH = "--platform linux/arm64 --platform linux/amd64"
AMD64_ONLY = "--platform linux/amd64"

PLAN_VARS = (
    "BUILD_CONTEXT",
    "BUILD_CONTEXT_REF",
    "PLATFORM_ARG",
    "PUSH_OR_LOAD",
    "PUBLISH_DOCKER_CACHE",
    "RELEASE_BRANCH_TAG",
)


def _build_plan(
    event_name: str,
    ref: str,
    ref_name: str = "",
    preset: str = "superset",
    sha: str = SHA,
    repository: str = PUBLISHING_REPOSITORY,
) -> dict[str, str]:
    """Runs the plan script and returns the variables it emits.

    Consumes the output through ``eval`` the way ``docker.yml`` does, rather
    than parsing it, so a quoting regression in the script's ``printf %q``
    would surface here as a wrong value instead of being normalised away.
    """
    readback = "; ".join(f'printf "%s=%s\\n" {var} "${var}"' for var in PLAN_VARS)
    result = subprocess.run(  # noqa: S603
        [
            BASH,
            "-c",
            f'set -euo pipefail; eval "$(bash {PLAN_SCRIPT} "$@")"; {readback}',
            "bash",
            event_name,
            ref,
            ref_name,
            preset,
            sha,
            repository,
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return dict(
        line.split("=", 1) for line in result.stdout.splitlines() if "=" in line
    )


def test_master_push_publishes_multi_arch_and_writes_cache() -> None:
    """Master keeps its existing behaviour, including owning the shared cache.

    Guards the refactor that taught the script about release branches: master
    is the only ref allowed to export registry cache layers, and it publishes
    via supersetbot's own ``master`` tag rather than an injected one.
    """
    plan = _build_plan("push", "refs/heads/master", "master")

    assert plan["PUSH_OR_LOAD"] == "--push"
    assert plan["PLATFORM_ARG"] == MULTI_ARCH
    assert plan["BUILD_CONTEXT_REF"] == "master"
    assert plan["PUBLISH_DOCKER_CACHE"] == "true"
    assert plan["RELEASE_BRANCH_TAG"] == ""


@pytest.mark.parametrize("branch", ["7.0", "6.1", "5.0", "10.0"])
@pytest.mark.parametrize("preset", ["superset", "lean", "dev"])
def test_release_branch_publishes_commit_addressable_tag(
    branch: str, preset: str
) -> None:
    """A release branch publishes ``<branch>-<sha7>`` and nothing mutable.

    ``10.0`` is included because the workflow's push filter would not match it
    today; the classification rule must not be the thing that breaks when that
    filter is eventually widened.
    """
    plan = _build_plan("push", f"refs/heads/{branch}", branch, preset)

    assert plan["PUSH_OR_LOAD"] == "--push"
    assert plan["PLATFORM_ARG"] == MULTI_ARCH
    assert plan["RELEASE_BRANCH_TAG"] == f"{branch}-{SHORT_SHA}"
    # supersetbot derives a branch tag only for master; leaving this empty is
    # what keeps it from inventing one for a release ref.
    assert plan["BUILD_CONTEXT_REF"] == ""
    # Master owns the shared cache ref, so a release branch reads it but must
    # never overwrite the layers master and every local Compose build pull.
    assert plan["PUBLISH_DOCKER_CACHE"] == ""


@pytest.mark.parametrize(
    "branch",
    [
        # Matches the workflow's "[0-9].[0-9]*" push filter without being a
        # release branch -- both of these exist in the repository's history.
        "0.36.0-lyft1",
        "2021.21.1",
        # A release *tag* name, and a branch that merely starts like one.
        "7.0.0",
        "7.0-rc1",
        "feature/7.0",
        "master-backup",
    ],
)
def test_non_release_branch_never_publishes(branch: str) -> None:
    """Only a branch named exactly ``N.N`` may publish."""
    plan = _build_plan("push", f"refs/heads/{branch}", branch)

    assert plan["PUSH_OR_LOAD"] == "--load"
    assert plan["PLATFORM_ARG"] == AMD64_ONLY
    assert plan["RELEASE_BRANCH_TAG"] == ""


@pytest.mark.parametrize("preset", ["py311", "py312"])
def test_validation_only_preset_on_release_branch_does_not_publish(
    preset: str,
) -> None:
    """Release branches publish only the presets people deploy or debug with."""
    plan = _build_plan("push", "refs/heads/7.0", "7.0", preset)

    assert plan["PUSH_OR_LOAD"] == "--load"
    assert plan["RELEASE_BRANCH_TAG"] == ""


def test_fork_release_branch_does_not_publish() -> None:
    """A fork cannot authenticate to ``apache/*``, so it must not try.

    The Docker Hub login step is ``continue-on-error``, so without this gate a
    fork pushing a branch named ``N.N`` would spend the full build only to fail
    on a registry 401 at the very end.
    """
    plan = _build_plan("push", "refs/heads/7.0", "7.0", repository=FORK_REPOSITORY)

    assert plan["PUSH_OR_LOAD"] == "--load"
    assert plan["RELEASE_BRANCH_TAG"] == ""


def test_pull_request_does_not_publish() -> None:
    plan = _build_plan("pull_request", "refs/pull/44250/merge")

    assert plan["PUSH_OR_LOAD"] == "--load"
    assert plan["PLATFORM_ARG"] == AMD64_ONLY
    assert plan["RELEASE_BRANCH_TAG"] == ""


@pytest.mark.parametrize("sha", ["", "deadbeef", SHA.upper(), f"{SHA}0"])
def test_release_branch_rejects_unusable_sha(sha: str) -> None:
    """Fail the build rather than publish a tag nobody can map to a commit."""
    with pytest.raises(subprocess.CalledProcessError) as excinfo:
        _build_plan("push", "refs/heads/7.0", "7.0", sha=sha)

    assert "unusable SHA" in excinfo.value.stderr


def test_unsupported_event_fails() -> None:
    with pytest.raises(subprocess.CalledProcessError) as excinfo:
        _build_plan("schedule", "refs/heads/master", "master")

    assert "Unsupported GitHub event" in excinfo.value.stderr


def _extra_flags(preset: str, release_branch_tag: str | None = None) -> str:
    """Runs the flags helper the way the build step does.

    Runs from the repository root because the script reads the Dockerfile's
    ``ARG PY_VER`` out of the working tree.
    """
    env = {"PATH": "/usr/bin:/bin:/usr/sbin:/sbin"}
    if release_branch_tag is not None:
        env["RELEASE_BRANCH_TAG"] = release_branch_tag
    result = subprocess.run(  # noqa: S603
        [BASH, FLAGS_SCRIPT, preset, "apache/superset:GHA-preset-1"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
        env=env,
    )
    return result.stdout.strip()


@pytest.mark.parametrize(
    "preset,expected_tag",
    [
        ("superset", f"apache/superset:7.0-{SHORT_SHA}"),
        ("lean", f"apache/superset:7.0-{SHORT_SHA}-lean"),
        ("dev", f"apache/superset:7.0-{SHORT_SHA}-dev"),
    ],
)
def test_release_branch_tag_is_suffixed_per_preset(
    preset: str, expected_tag: str
) -> None:
    """Each matrix leg gets its own tag, so they cannot race on a shared one."""
    flags = _extra_flags(preset, f"7.0-{SHORT_SHA}")

    assert f"--tag {expected_tag}" in flags


def test_no_release_branch_tag_without_the_variable() -> None:
    """A master push or a validation build adds no branch tag."""
    flags = _extra_flags("lean")

    assert "7.0-" not in flags
    # The workflow's own per-run tag is unaffected.
    assert "--tag apache/superset:GHA-preset-1" in flags
