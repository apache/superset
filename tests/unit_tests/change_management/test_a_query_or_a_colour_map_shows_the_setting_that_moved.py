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
"""``query_context`` and the colour maps show the setting, not the word.

``query_context`` is a chart's stored query. It came out as "Changed" or as
one storage key name, and a reviewer has no way to tell a different metric
from a different row limit from either. ``label_colors`` and
``map_label_colors`` are dicts, which the scalar renderer could not draw at
all. Both are objects, and an object is compared key by key down to a
readable level, so what is listed is the colour that moved and the query
setting that moved, each with its two values.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from asset_approval import api
from superset.utils import json


def _request(payload: dict[str, Any], command: str | None = None) -> Any:
    return SimpleNamespace(
        operation="update",
        command_args={"command": command} if command else {},
        payload_dict=payload,
    )


def test_a_query_names_the_nested_setting_that_moved() -> None:
    stored = {
        "datasource": {"id": 4, "type": "table"},
        "form_data": {"row_limit": 100, "metrics": ["count"]},
        "queries": [{"row_limit": 100}],
    }
    proposed = {**stored, "form_data": {"row_limit": 100000, "metrics": ["count"]}}
    asset = SimpleNamespace(query_context=json.dumps(stored))

    [entry] = api.describe_changes(
        _request({"query_context": json.dumps(proposed)}), asset
    )

    assert entry["entries"] == [
        {"kind": "changed", "key": "form_data.row_limit", "before": "100", "after": "100000"}
    ]


def test_a_label_colour_that_moved_is_shown_with_both_colours() -> None:
    asset = SimpleNamespace(
        json_metadata=json.dumps({"label_colors": {"Sales": "#111111", "Churn": "#222222"}})
    )

    [entry] = api.describe_changes(
        _request({"label_colors": {"Sales": "#ff0000", "Churn": "#222222"}}, "colors"),
        asset,
    )

    assert entry["entries"] == [
        {"kind": "changed", "key": "Sales", "before": "#111111", "after": "#ff0000"}
    ]


def test_a_colour_added_to_the_map_is_shown_as_added() -> None:
    asset = SimpleNamespace(json_metadata=json.dumps({"label_colors": {"Sales": "#111111"}}))

    [entry] = api.describe_changes(
        _request({"label_colors": {"Sales": "#111111", "Refunds": "#00ff00"}}, "colors"),
        asset,
    )

    assert entry["entries"] == [
        {"kind": "added", "key": "Refunds", "after": "#00ff00"}
    ]


def test_the_map_label_colours_are_drawn_too() -> None:
    asset = SimpleNamespace(json_metadata="{}")

    [entry] = api.describe_changes(
        _request({"map_label_colors": {"Sales": "#ff0000"}}, "colors"), asset
    )

    assert entry["field"] == "map_label_colors"
    assert {(e["kind"], e["key"]) for e in entry["entries"]} == {("added", "Sales")}
