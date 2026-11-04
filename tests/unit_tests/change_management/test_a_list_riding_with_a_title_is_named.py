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
"""An exempt list that rides with a governed edit is shown, by name.

Editors, viewers and tags are exempt from review on their own. The exemption
is per write, so one travelling with a title change is part of a governed
write, and approving the title approves the access grant. The scalar renderer
had nothing to say about a list, so the reviewer saw a raw key and the word
"Changed". A chart's ``dashboards`` list read the same: no dashboard name, no
count, no direction.

Names are resolved from ids where the field has a table to look in; where it
does not, or the lookup fails, the id is shown, which is still a before and
an after.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from asset_approval import api
from pytest_mock import MockerFixture


def _request(payload: dict[str, Any]) -> Any:
    return SimpleNamespace(operation="update", command_args={}, payload_dict=payload)


def _row(ident: int, **fields: Any) -> SimpleNamespace:
    return SimpleNamespace(id=ident, **fields)


def test_a_viewer_grant_riding_with_a_title_is_named(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={1: "Ann", 7: "Everyone"})
    asset = SimpleNamespace(
        dashboard_title="Old", viewers=[_row(1, label="Ann")]
    )

    entries = api.describe_changes(
        _request({"dashboard_title": "New", "viewers": [1, 7]}), asset
    )

    viewers = next(e for e in entries if e["field"] == "viewers")
    assert [(e["kind"], e["key"]) for e in viewers["entries"]] == [
        ("added", "Everyone")
    ]
    assert viewers["before"] == "Ann"
    assert viewers["after"] == "Ann, Everyone"
    assert viewers["count"] == {"before": 1, "after": 2}


def test_an_editor_removed_is_named_as_removed(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={})
    asset = SimpleNamespace(
        dashboard_title="T", editors=[_row(1, label="Ann"), _row(2, label="Bo")]
    )

    entries = api.describe_changes(
        _request({"dashboard_title": "U", "editors": [1]}), asset
    )

    editors = next(e for e in entries if e["field"] == "editors")
    assert [(e["kind"], e["key"]) for e in editors["entries"]] == [("removed", "Bo")]


def test_tags_sent_by_name_are_compared_with_tags_held_as_rows(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(api, "_names_of", return_value={})
    asset = SimpleNamespace(slice_name="C", tags=[_row(5, name="finance")])

    entries = api.describe_changes(
        _request({"slice_name": "D", "tags": ["finance", "restricted"]}), asset
    )

    tags = next(e for e in entries if e["field"] == "tags")
    assert [(e["kind"], e["key"]) for e in tags["entries"]] == [
        ("added", "restricted")
    ]


def test_a_chart_s_dashboards_show_names_a_count_and_a_direction(
    mocker: MockerFixture,
) -> None:
    """C12."""
    mocker.patch.object(
        api, "_names_of", return_value={10: "Board pack", 11: "Public"}
    )
    asset = SimpleNamespace(dashboards=[_row(10, dashboard_title="Board pack")])

    [entry] = api.describe_changes(_request({"dashboards": [10, 11]}), asset)

    assert entry["after"] == "Board pack, Public"
    assert entry["count"] == {"before": 1, "after": 2}
    assert [(e["kind"], e["key"]) for e in entry["entries"]] == [("added", "Public")]


def test_a_list_whose_names_cannot_be_looked_up_is_shown_by_id(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(api, "_names_of", return_value={})
    asset = SimpleNamespace(dashboards=[])

    [entry] = api.describe_changes(_request({"dashboards": [10]}), asset)

    assert entry["after"] == "10"


def test_a_failed_lookup_costs_the_name_and_not_the_row(mocker: MockerFixture) -> None:
    """``_names_of`` is the only thing that touches the database."""
    mocker.patch.object(api.db.session, "query", side_effect=RuntimeError("down"))
    asset = SimpleNamespace(dashboards=[])

    [entry] = api.describe_changes(_request({"dashboards": [10]}), asset)

    assert entry["after"] == "10"
    assert entry["entries"] == [{"kind": "added", "key": "10"}]


def test_a_collection_reordered_only_still_has_both_sides(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={})
    asset = SimpleNamespace(
        dashboards=[_row(1, dashboard_title="A"), _row(2, dashboard_title="B")]
    )

    entry = api._field_entry("dashboards", asset.dashboards, [2, 1], asset=asset)

    assert entry["before"] == "A, B"
    assert entry["after"] == "2, 1"
    assert "entries" not in entry
