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
"""The reviewer is shown the exempt fields approval will write, and only those.

An exempt field (editors, viewers, tags, ...) applies the moment it is saved,
so a copy of one inside a held request is a snapshot -- unless it travelled
with a governed field and *changed*, in which case the gate held it too and
named it on the capture (``gate.captured_exempt_fields``). Replay writes
exactly those and drops the rest.

The panel listed every exempt field that differed from the live asset, which
is a different set. A ``viewers`` list the form merely echoed (and that
someone has since changed) showed as an access change the reviewer was
approving, when approving would never write it; and the mirror image, hiding a
field that *is* written, would be a blind approval. The panel asks the capture
instead of guessing -- the C11 area, an access grant riding with a title.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from pytest_mock import MockerFixture


def _request(payload: dict[str, Any], exempt: list[str] | None = None) -> Any:
    args: dict[str, Any] = {} if exempt is None else {"exempt_fields": exempt}
    return SimpleNamespace(operation="update", command_args=args, payload_dict=payload)


def _row(ident: int, label: str) -> Any:
    return SimpleNamespace(id=ident, label=label)


@pytest.fixture(autouse=True)
def no_database(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={})


def _dashboard() -> Any:
    # Ann was the only viewer when the author saved. Bo was added since.
    return SimpleNamespace(
        dashboard_title="Old", viewers=[_row(1, "Ann"), _row(2, "Bo")]
    )


def test_an_exempt_field_the_write_changed_is_shown() -> None:
    entries = api.describe_changes(
        _request({"dashboard_title": "New", "viewers": [1]}, exempt=["viewers"]),
        _dashboard(),
    )

    assert [entry["field"] for entry in entries] == ["dashboard_title", "viewers"]


def test_an_exempt_field_that_only_echoes_the_form_is_not_shown() -> None:
    """Approving drops it, so listing it would describe something that does not
    happen: here, Bo's access being removed."""
    entries = api.describe_changes(
        _request({"dashboard_title": "New", "viewers": [1]}, exempt=[]),
        _dashboard(),
    )

    assert [entry["field"] for entry in entries] == ["dashboard_title"]


def test_a_capture_that_never_recorded_owns_no_exempt_field() -> None:
    """The same reading replay has: no record means none are written."""
    entries = api.describe_changes(
        _request({"dashboard_title": "New", "viewers": [1]}), _dashboard()
    )

    assert [entry["field"] for entry in entries] == ["dashboard_title"]


def test_only_the_owned_one_of_two_exempt_fields_is_shown() -> None:
    asset = SimpleNamespace(
        dashboard_title="Old", viewers=[_row(1, "Ann")], editors=[_row(1, "Ann")]
    )

    entries = api.describe_changes(
        _request(
            {"dashboard_title": "New", "viewers": [1, 3], "editors": [2]},
            exempt=["viewers"],
        ),
        asset,
    )

    assert [entry["field"] for entry in entries] == ["dashboard_title", "viewers"]


def test_a_governed_field_is_never_hidden_by_the_filter() -> None:
    """The filter narrows exempt fields only."""
    asset = SimpleNamespace(slice_name="Old", description="d", cache_timeout=None)

    entries = api.describe_changes(
        _request({"slice_name": "New", "cache_timeout": 9}, exempt=[]), asset
    )

    assert [entry["field"] for entry in entries] == ["cache_timeout", "slice_name"]


def test_the_payload_lists_the_same_fields_the_panel_does() -> None:
    """``changed_fields`` on the payload is read by the client too."""
    request = _request(
        {"dashboard_title": "New", "viewers": [1]}, exempt=[]
    )

    assert api.applied_fields(request, _dashboard()) == ["dashboard_title"]
    request.command_args = {"exempt_fields": ["viewers"]}
    assert api.applied_fields(request, _dashboard()) == ["dashboard_title", "viewers"]


def test_a_dataset_s_settings_follow_the_same_rule(mocker: MockerFixture) -> None:
    mocker.patch.object(
        api, "dataset_impact", return_value={"charts": 0, "dashboards": 0}
    )
    live = SimpleNamespace(
        sql="SELECT 1", description="old", columns=[], metrics=[], viewers=[]
    )
    request = SimpleNamespace(
        id=1,
        asset_type="dataset",
        operation="update",
        payload_dict={"sql": "SELECT 2", "description": "new", "viewers": [1]},
        command_args={"exempt_fields": ["description"]},
    )

    detail = api.dataset_detail(request, live)

    assert [row["field"] for row in detail["settings"]] == ["description"]
