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

from __future__ import annotations

import runpy
from pathlib import Path
from typing import Any

import pytest


@pytest.mark.parametrize(
    ("local_config", "enabled", "namespace"),
    [
        ("", False, "superset"),
        (
            "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED = True\n"
            "SEMANTIC_LAYER_METADATA_NAMESPACE = 'tenant-catalog'\n",
            True,
            "tenant-catalog",
        ),
        (
            "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED = False\n"
            "SEMANTIC_LAYER_METADATA_NAMESPACE = 'disabled-catalog'\n",
            False,
            "disabled-catalog",
        ),
    ],
)
def test_metadata_refresh_operator_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    local_config: str,
    enabled: bool,
    namespace: str,
) -> None:
    """Preserve explicit rollout/tenant settings while defaulting refresh off."""
    from superset import config

    config_file: Path = tmp_path / "superset_config.py"
    config_file.write_text(local_config)
    monkeypatch.setenv("SUPERSET_CONFIG_PATH", str(config_file))
    loaded: dict[str, Any] = runpy.run_path(config.__file__)
    assert loaded["SEMANTIC_LAYER_METADATA_REFRESH_ENABLED"] is enabled
    assert loaded["SEMANTIC_LAYER_METADATA_NAMESPACE"] == namespace
