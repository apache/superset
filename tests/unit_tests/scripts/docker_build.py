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
import os
import sys

import pytest

SHA = "22e7c602b9aa321ec7e0df4bb0033048664dcdf0"
PR_ID = "666"
OLD_REL = "2.1.0"
NEW_REL = "2.1.1"
REPO = "apache/superset"

# Add the 'scripts' directory to sys.path
scripts_dir = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../scripts")
)
sys.path.append(scripts_dir)

import build_docker as docker_utils  # Replace with the actual function name  # noqa: E402


@pytest.fixture(autouse=True)
def set_env_var():
    os.environ["TEST_ENV"] = "true"
    yield
    del os.environ["TEST_ENV"]


@pytest.mark.parametrize(
    "release, expected_bool",
    [
        ("2.1.0", False),
        ("2.1.1", True),
        ("1.0.0", False),
        ("3.0.0", True),
    ],
)
def test_is_latest_release(release, expected_bool):
    assert docker_utils.is_latest_release(release) == expected_bool


@pytest.mark.parametrize(
    "build_preset, build_platforms, sha, build_context, build_context_ref, expected_tags",
    [
        # PRs
        (
            "lean",
            ["linux/arm64"],
            SHA,
            "pull_request",
            PR_ID,
            [f"{REPO}:22e7c60-arm", f"{REPO}:{SHA}-arm", f"{REPO}:pr-{PR_ID}-arm"],
        ),
        (
            "ci",
            ["linux/amd64"],
            SHA,
            "pull_request",
            PR_ID,
            [f"{REPO}:22e7c60-ci", f"{REPO}:{SHA}-ci", f"{REPO}:pr-{PR_ID}-ci"],
        ),
        (
            "lean",
            ["linux/amd64"],
            SHA,
            "pull_request",
            PR_ID,
            [f"{REPO}:22e7c60", f"{REPO}:{SHA}", f"{REPO}:pr-{PR_ID}"],
        ),
        (
            "dev",
            ["linux/arm64"],
            SHA,
            "pull_request",
            PR_ID,
            [
                f"{REPO}:22e7c60-dev-arm",
                f"{REPO}:{SHA}-dev-arm",
                f"{REPO}:pr-{PR_ID}-dev-arm",
            ],
        ),
        (
            "dev",
            ["linux/amd64"],
            SHA,
            "pull_request",
            PR_ID,
            [f"{REPO}:22e7c60-dev", f"{REPO}:{SHA}-dev", f"{REPO}:pr-{PR_ID}-dev"],
        ),
        # old releases
        (
            "lean",
            ["linux/arm64"],
            SHA,
            "release",
            OLD_REL,
            [f"{REPO}:22e7c60-arm", f"{REPO}:{SHA}-arm", f"{REPO}:{OLD_REL}-arm"],
        ),
        (
            "lean",
            ["linux/amd64"],
            SHA,
            "release",
            OLD_REL,
            [f"{REPO}:22e7c60", f"{REPO}:{SHA}", f"{REPO}:{OLD_REL}"],
        ),
        (
            "dev",
            ["linux/arm64"],
            SHA,
            "release",
            OLD_REL,
            [
                f"{REPO}:22e7c60-dev-arm",
                f"{REPO}:{SHA}-dev-arm",
                f"{REPO}:{OLD_REL}-dev-arm",
            ],
        ),
        (
            "dev",
            ["linux/amd64"],
            SHA,
            "release",
            OLD_REL,
            [f"{REPO}:22e7c60-dev", f"{REPO}:{SHA}-dev", f"{REPO}:{OLD_REL}-dev"],
        ),
        # new releases
        (
            "lean",
            ["linux/arm64"],
            SHA,
            "release",
            NEW_REL,
            [
                f"{REPO}:22e7c60-arm",
                f"{REPO}:{SHA}-arm",
                f"{REPO}:{NEW_REL}-arm",
                f"{REPO}:latest-arm",
            ],
        ),
        (
            "lean",
            ["linux/amd64"],
            SHA,
            "release",
            NEW_REL,
            [f"{REPO}:22e7c60", f"{REPO}:{SHA}", f"{REPO}:{NEW_REL}", f"{REPO}:latest"],
        ),
        (
            "dev",
            ["linux/arm64"],
            SHA,
            "release",
            NEW_REL,
            [
                f"{REPO}:22e7c60-dev-arm",
                f"{REPO}:{SHA}-dev-arm",
                f"{REPO}:{NEW_REL}-dev-arm",
                f"{REPO}:latest-dev-arm",
            ],
        ),
        (
            "dev",
            ["linux/amd64"],
            SHA,
            "release",
            NEW_REL,
            [
                f"{REPO}:22e7c60-dev",
                f"{REPO}:{SHA}-dev",
                f"{REPO}:{NEW_REL}-dev",
                f"{REPO}:latest-dev",
            ],
        ),
        # merge on master
        (
            "lean",
            ["linux/arm64"],
            SHA,
            "push",
            "master",
            [f"{REPO}:22e7c60-arm", f"{REPO}:{SHA}-arm", f"{REPO}:master-arm"],
        ),
        (
            "lean",
            ["linux/amd64"],
            SHA,
            "push",
            "master",
            [f"{REPO}:22e7c60", f"{REPO}:{SHA}", f"{REPO}:master"],
        ),
        (
            "dev",
            ["linux/arm64"],
            SHA,
            "push",
            "master",
            [
                f"{REPO}:22e7c60-dev-arm",
                f"{REPO}:{SHA}-dev-arm",
                f"{REPO}:master-dev-arm",
            ],
        ),
        (
            "dev",
            ["linux/amd64"],
            SHA,
            "push",
            "master",
            [f"{REPO}:22e7c60-dev", f"{REPO}:{SHA}-dev", f"{REPO}:master-dev"],
        ),
    ],
)
def test_get_docker_tags(
    build_preset, build_platforms, sha, build_context, build_context_ref, expected_tags
):
    tags = docker_utils.get_docker_tags(
        build_preset, build_platforms, sha, build_context, build_context_ref
    )
    for tag in expected_tags:
        assert tag in tags


@pytest.mark.parametrize(
    "build_preset, build_platforms, is_authenticated, sha, build_context, build_context_ref, contains",
    [
        (
            "lean",
            ["linux/amd64"],
            True,
            SHA,
            "push",
            "master",
            ["--push", f"-t {REPO}:master "],
        ),
        (
            "dev",
            ["linux/amd64"],
            False,
            SHA,
            "push",
            "master",
            ["--load", f"-t {REPO}:master-dev ", "--target dev"],
        ),
        # multi-platform
        (
            "lean",
            ["linux/arm64", "linux/amd64"],
            True,
            SHA,
            "push",
            "master",
            ["--platform linux/arm64,linux/amd64"],
        ),
    ],
)
def test_get_docker_command(
    build_preset,
    build_platforms,
    is_authenticated,
    sha,
    build_context,
    build_context_ref,
    contains,
):
    cmd = docker_utils.get_docker_command(
        build_preset,
        build_platforms,
        is_authenticated,
        sha,
        build_context,
        build_context_ref,
    )
    for s in contains:
        assert s in cmd
