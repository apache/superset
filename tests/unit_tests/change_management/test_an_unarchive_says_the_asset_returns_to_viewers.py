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
"""An un-archive says what approving does, not the uuid it carries.

The captured body of a restore is the asset's own uuid, so the generic path
drew ``uuid`` / an em-dash / ``<uuid>`` and nothing said the asset returns to
the people who can see it. ``_describe_command`` did not list the restore
command at all.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api, gate


def _restore(asset_type: str = "chart") -> Any:
    return SimpleNamespace(
        id=1,
        asset_type=asset_type,
        operation="update",
        command_args={gate.COMMAND_KEY: gate.RESTORE_COMMAND},
        payload_dict={"uuid": "5f0c3c47-6f58-4a3e-8d0b-1c2c3d4e5f60"},
    )


@pytest.mark.parametrize("asset_type", ["chart", "dashboard", "dataset"])
def test_a_restore_says_the_asset_returns_to_viewers(asset_type: str) -> None:
    asset = SimpleNamespace(deleted_at="2026-11-01")

    [entry] = api.describe_changes(_restore(asset_type), asset)

    assert entry["field"] == "archived"
    assert "hidden" in entry["before"]
    assert "visible to viewers" in entry["after"]


def test_the_uuid_is_not_listed_as_a_change() -> None:
    entries = api.describe_changes(_restore(), SimpleNamespace(deleted_at="x"))

    assert "uuid" not in [entry["field"] for entry in entries]


def test_a_restore_works_with_nothing_loaded() -> None:
    """The asset can be unreadable; what approving does is not in doubt."""
    [entry] = api.describe_changes(_restore(), None)

    assert entry["field"] == "archived"
