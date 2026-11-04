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
"""A version restore names its version, who saved it and what that save did.

The change request records the version's number and uuid and nothing else, so
the panel read ``version`` / an em-dash / "Version 0". Version history
already keeps, per version, who saved it, when, and the list of changes that
save made; those are read from it and not recorded again.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from asset_approval import api, gate
from pytest_mock import MockerFixture


def _restore(number: int | None = 3) -> Any:
    args: dict[str, Any] = {gate.COMMAND_KEY: gate.RESTORE_VERSION_COMMAND}
    if number is not None:
        args["version_number"] = number
    return SimpleNamespace(
        operation="update",
        command_args=args,
        payload_dict={"version_uuid": "v-uuid"},
    )


def _saved() -> dict[str, Any]:
    return {
        "version_uuid": "v-uuid",
        "version_number": 3,
        "issued_at": "2026-11-01T10:00:00",
        "changed_by": {"first_name": "Mo", "last_name": "Maker"},
        "changes": [
            {
                "kind": "field",
                "operation": "update",
                "path": ["dashboard_title"],
                "from_value": "Old",
                "to_value": "New",
            },
            {
                "kind": "chart",
                "operation": "remove",
                "path": ["position", "CHART-2"],
                "from_value": "Churn",
                "to_value": None,
            },
        ],
    }


def test_the_version_is_named_with_who_saved_it_and_when(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(api, "_saved_version", return_value=_saved())

    [entry] = api.describe_changes(_restore(), SimpleNamespace(uuid="u"))

    assert entry["after"] == "Version 3"
    assert entry["saved_by"] == "Mo Maker"
    assert entry["saved_at"] == "2026-11-01T10:00:00"


def test_what_that_version_changed_is_listed(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_saved_version", return_value=_saved())

    [entry] = api.describe_changes(_restore(), SimpleNamespace(uuid="u"))

    assert entry["entries"] == [
        {"kind": "changed", "key": "dashboard_title", "before": "Old", "after": "New"},
        {"kind": "removed", "key": "position · CHART-2", "before": "Churn"},
    ]


def test_a_history_that_cannot_be_read_still_names_the_version(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(api, "_saved_version", side_effect=RuntimeError("no history"))

    [entry] = api.describe_changes(_restore(), SimpleNamespace(uuid="u"))

    assert entry == {"field": "version", "before": None, "after": "Version 3"}


def test_a_restore_with_no_number_falls_back_to_the_uuid(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_saved_version", return_value=None)

    [entry] = api.describe_changes(_restore(None), SimpleNamespace(uuid="u"))

    assert entry["after"] == "v-uuid"
