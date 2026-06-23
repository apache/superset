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
"""Tests for environment-driven Swagger UI config defaults.

``superset.config`` is imported in a fresh subprocess for each case so the
module is evaluated under a controlled environment without reloading (and
mutating) the config module shared by the rest of the test session.
"""

import os
import subprocess
import sys

import pytest


def _resolve_swagger_default(env_value: str | None) -> str:
    env = dict(os.environ)
    env.pop("SUPERSET_ENABLE_SWAGGER_UI", None)
    if env_value is not None:
        env["SUPERSET_ENABLE_SWAGGER_UI"] = env_value
    result = subprocess.run(  # noqa: S603
        [
            sys.executable,
            "-c",
            "import superset.config as c; print(c.FAB_API_SWAGGER_UI)",
        ],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


@pytest.mark.parametrize(
    "env_value, expected",
    [
        (None, "False"),  # unset -> off by default
        ("true", "True"),
        ("True", "True"),
        ("false", "False"),
        ("", "False"),
    ],
)
def test_fab_api_swagger_ui_is_env_driven_and_off_by_default(
    env_value: str | None, expected: str
) -> None:
    assert _resolve_swagger_default(env_value) == expected
