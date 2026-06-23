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
"""Tests for environment-driven Swagger UI config defaults."""

import importlib
import os

import pytest


@pytest.mark.parametrize(
    "env_value, expected",
    [
        (None, False),  # unset -> off by default
        ("true", True),
        ("True", True),
        ("false", False),
        ("", False),
    ],
)
def test_fab_api_swagger_ui_is_env_driven_and_off_by_default(
    monkeypatch: pytest.MonkeyPatch, env_value: str | None, expected: bool
) -> None:
    original = os.environ.get("SUPERSET_ENABLE_SWAGGER_UI")

    if env_value is None:
        monkeypatch.delenv("SUPERSET_ENABLE_SWAGGER_UI", raising=False)
    else:
        monkeypatch.setenv("SUPERSET_ENABLE_SWAGGER_UI", env_value)

    import superset.config as config

    importlib.reload(config)
    try:
        assert config.FAB_API_SWAGGER_UI is expected
    finally:
        # Reload against the env value present before this test ran so the
        # module state stays consistent with what monkeypatch restores on
        # teardown, avoiding leakage into other tests.
        if original is None:
            monkeypatch.delenv("SUPERSET_ENABLE_SWAGGER_UI", raising=False)
        else:
            monkeypatch.setenv("SUPERSET_ENABLE_SWAGGER_UI", original)
        importlib.reload(config)
