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
"""A filter or customization diff says what it does to each entry.

The body of the native-filter and chart-customization endpoints is
``{modified, deleted, reordered}`` against the stored list. The description
was a fixed ``{"field": ..., "opaque": True}``, so the reviewer read
"Changed" whatever the diff held, and ``deleted`` -- the one list that takes
something away -- was discarded outright: removing a filter read exactly
like adding one.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from superset.utils import json

FILTERS = [
    {"id": "F1", "name": "Country", "filterType": "filter_select", "controlValues": {"multiSelect": True}},
    {"id": "F2", "name": "Region", "filterType": "filter_select"},
]


def _dashboard(key: str = "native_filter_configuration") -> Any:
    return SimpleNamespace(json_metadata=json.dumps({key: FILTERS}))


def _request(body: dict[str, Any], command: str = "native_filters") -> Any:
    return SimpleNamespace(
        operation="update", command_args={"command": command}, payload_dict=body
    )


def _entries(body: dict[str, Any], **kwargs: Any) -> list[dict[str, Any]]:
    [entry] = api.describe_changes(_request(body, **kwargs), _dashboard())
    assert entry["field"] == "native_filter_configuration"
    return entry["entries"]


def test_a_deleted_filter_is_named_as_removed() -> None:
    entries = _entries({"deleted": ["F2"]})

    assert [(e["kind"], e["key"]) for e in entries] == [("removed", "Region")]
    assert "filter_select" in entries[0]["before"]


def test_a_new_filter_is_named_as_added() -> None:
    entries = _entries({"modified": [{"id": "F3", "name": "Segment"}]})

    assert [(e["kind"], e["key"]) for e in entries] == [("added", "Segment")]


def test_removing_and_adding_are_not_the_same_description() -> None:
    removed = _entries({"deleted": ["F2"]})
    added = _entries({"modified": [{"id": "F3", "name": "Region"}]})

    assert removed[0]["kind"] != added[0]["kind"]


def test_an_edited_filter_shows_the_setting_that_changed() -> None:
    edited = {**FILTERS[0], "controlValues": {"multiSelect": False}}

    entries = _entries({"modified": [edited]})

    assert entries == [
        {
            "kind": "changed",
            "key": "Country · controlValues.multiSelect",
            "before": "true",
            "after": "false",
        }
    ]


def test_a_modified_entry_that_drops_keys_shows_them_removed() -> None:
    """The DAO replaces a modified entry whole, so an id-only entry reduces a
    reviewed filter to ``{"id": ...}``. The reviewer must see that."""
    entries = _entries({"modified": [{"id": "F1"}]})

    assert {e["key"] for e in entries} >= {
        "Country · name",
        "Country · filterType",
        "Country · controlValues",
    }
    assert all(e["kind"] == "removed" for e in entries)


def test_a_reorder_shows_the_order_before_and_after() -> None:
    entries = _entries({"reordered": ["F2", "F1"]})

    assert entries == [
        {"kind": "changed", "key": "order", "before": "Country, Region", "after": "Region, Country"}
    ]


@pytest.mark.parametrize("key", ["chart_customization_config"])
def test_chart_customizations_are_described_the_same_way(key: str) -> None:
    asset = _dashboard(key)

    [entry] = api.describe_changes(
        _request({"deleted": ["F1"]}, "chart_customizations"), asset
    )

    assert entry["field"] == key
    assert [(e["kind"], e["key"]) for e in entry["entries"]] == [("removed", "Country")]


def test_a_body_that_is_not_a_diff_is_shown_as_it_is() -> None:
    """Fail closed: never the bare word, whatever the body looks like."""
    [entry] = api.describe_changes(
        _request({"something": "unexpected"}), _dashboard()
    )

    assert "unexpected" in entry["after"]


def test_the_same_filters_inside_json_metadata_are_told_apart_too() -> None:
    """A dashboard save carries the whole list instead of a diff."""
    asset = SimpleNamespace(
        json_metadata=json.dumps({"native_filter_configuration": FILTERS}),
        position_json="{}",
    )
    proposed = json.dumps({"native_filter_configuration": FILTERS[:1]})
    request = SimpleNamespace(
        operation="update", command_args={}, payload_dict={"json_metadata": proposed}
    )

    [entry] = api.describe_changes(request, asset)

    assert [(e["kind"], e["key"]) for e in entry["entries"]] == [
        ("removed", "native_filter_configuration · Region")
    ]
