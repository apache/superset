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
import pytest

from scripts import docker_release_target

# A stage list representative of a Dockerfile predating #44100 (e.g. the
# actual 6.1.0 release): has `lean` but no `superset` stage.
PRE_44100_DOCKERFILE = """
FROM --platform=${BUILDPLATFORM} node:20-trixie-slim AS superset-node-ci
FROM superset-node-ci AS superset-node
FROM python:${PY_VER} AS python-base
FROM python-base AS python-translation-compiler
FROM python-base AS python-common
FROM python-common AS lean
FROM python-common AS dev
FROM lean AS ci
FROM lean AS showtime
"""

# The current Dockerfile shape (post-#44100): `superset` builds FROM `lean`.
CURRENT_DOCKERFILE = PRE_44100_DOCKERFILE + "\nFROM lean AS superset\n"

NO_LEAN_NO_SUPERSET_DOCKERFILE = """
FROM python:3.11 AS python-base
FROM python-base AS dev
"""


def _dry_run(target: str) -> str:
    """A minimal fragment shaped like `supersetbot docker --dry-run`'s real
    output -- only the parts docker_release_target.py actually reads."""
    return f"""Latest release: 6.1.0
Building {target} layer
dry-run: docker buildx build \\
      -t apache/superset:6.1.0 \\
      -t apache/superset:latest \\
      --cache-from=type=registry,ref=apache/superset-cache:3.10-slim-bookworm \\
      --target {target} \\
      --build-arg PY_VER=3.10-slim-bookworm \\
      --label target={target} \\
      .
"""


def test_current_release_needs_no_override() -> None:
    """Case A: current Dockerfile already has the `superset` stage."""
    assert (
        docker_release_target.resolve_extra_flags(
            "superset", _dry_run("superset"), CURRENT_DOCKERFILE
        )
        is None
    )


def test_historical_release_falls_back_to_lean() -> None:
    """Case B, and the #44220 regression itself: a pre-#44100 release (the
    actual 6.1.0 stage list) has no `superset` stage, but does have `lean`,
    which is what its plain tags were built from before #44100 split them
    out. This is the exact chain that produced #44220's failure."""
    assert (
        docker_release_target.resolve_extra_flags(
            "superset", _dry_run("superset"), PRE_44100_DOCKERFILE
        )
        == "--target lean --label target=lean"
    )


def test_lean_preset_needs_no_override() -> None:
    """Case C: the `lean` preset's own target already exists everywhere."""
    assert (
        docker_release_target.resolve_extra_flags(
            "lean", _dry_run("lean"), PRE_44100_DOCKERFILE
        )
        is None
    )


def test_unrelated_preset_with_missing_target_is_refused() -> None:
    """Case D: only the `superset` preset has a known-safe substitute. A
    `websocket`-targeting preset with a missing target must fail loudly, not
    silently fall back to `lean` just because `lean` happens to exist."""
    with pytest.raises(ValueError, match="websocket"):
        docker_release_target.resolve_extra_flags(
            "websocket", _dry_run("websocket"), PRE_44100_DOCKERFILE
        )


def test_superset_preset_without_lean_is_refused() -> None:
    """Case E: even for `superset`, there's no safe substitute to guess if
    the Dockerfile has neither `superset` nor `lean`."""
    with pytest.raises(ValueError, match="superset"):
        docker_release_target.resolve_extra_flags(
            "superset", _dry_run("superset"), NO_LEAN_NO_SUPERSET_DOCKERFILE
        )


def test_missing_target_in_dry_run_output_is_refused() -> None:
    """Case F: if supersetbot's dry-run output ever stops naming a --target
    (e.g. a future output-format change), fail loudly rather than silently
    disable the compatibility check -- the exact fragility this helper
    replaces (see the module's git history for the shell version's `set -e`
    pitfall here)."""
    with pytest.raises(ValueError, match="--target"):
        docker_release_target.resolve_extra_flags(
            "superset",
            "docker buildx build --platform linux/amd64 .",
            CURRENT_DOCKERFILE,
        )


@pytest.mark.parametrize(
    "dockerfile_fragment",
    [
        pytest.param("FROM lean AS superset\n", id="single-space-uppercase-AS"),
        pytest.param("FROM lean as superset\n", id="lowercase-as"),
        pytest.param("FROM lean    AS    superset\n", id="multiple-spaces"),
    ],
)
def test_stage_detection_whitespace_and_case_variants(dockerfile_fragment: str) -> None:
    assert (
        docker_release_target.resolve_extra_flags(
            "superset", _dry_run("superset"), dockerfile_fragment
        )
        is None
    )


def test_commented_out_stage_does_not_count() -> None:
    """A `# FROM ... AS superset` comment must not be mistaken for a real
    stage -- only PRE_44100_DOCKERFILE's genuine stages should be seen."""
    dockerfile = "# FROM lean AS superset\n" + PRE_44100_DOCKERFILE
    assert (
        docker_release_target.resolve_extra_flags(
            "superset", _dry_run("superset"), dockerfile
        )
        == "--target lean --label target=lean"
    )


def test_arbitrary_mention_of_stage_name_does_not_count() -> None:
    """`AS superset` appearing inside a RUN command's text must not be
    mistaken for an actual stage definition."""
    dockerfile = 'RUN echo "FROM foo AS superset"\n' + PRE_44100_DOCKERFILE
    assert (
        docker_release_target.resolve_extra_flags(
            "superset", _dry_run("superset"), dockerfile
        )
        == "--target lean --label target=lean"
    )


def test_last_target_flag_wins_when_multiple_are_present() -> None:
    """docker buildx keeps the LAST value of a repeated flag, so a dry-run
    string naming an earlier --target that isn't actually effective must not
    be mistaken for the real one."""
    dry_run_output = "--target superset --build-arg PY_VER=3.10 --target lean"
    assert (
        docker_release_target.resolve_extra_flags(
            "superset", dry_run_output, PRE_44100_DOCKERFILE
        )
        is None
    )
