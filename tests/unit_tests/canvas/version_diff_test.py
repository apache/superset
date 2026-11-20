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
"""What a canvas version's change records say about its definition."""

from __future__ import annotations

from typing import Any

from superset.utils import json
from superset.versioning.diff import ChangeRecord, diff_canvas_definition


def definition(
    nodes: dict[str, dict[str, Any]],
    children: list[str],
    **extra: Any,
) -> str:
    return json.dumps(
        {
            "version": 1,
            "root": {"layout": {"columns": 24}, "children": children},
            "nodes": nodes,
            "interactions": {"filters": {}},
            "settings": {"refresh": {"interval": 0}},
            **extra,
        }
    )


def summary(records: list[ChangeRecord]) -> list[tuple[str, str, list[Any]]]:
    return [(r.kind, r.operation, r.path) for r in records]


GROUP: dict[str, Any] = {
    "widgetType": "group",
    "schemaVersion": 1,
    "props": {},
    "layout": {},
}


def test_added_and_removed_nodes_are_named_by_title_or_widget() -> None:
    before = definition({"old": {"widgetId": "w-1", "layout": {}}}, ["old"])
    after = definition(
        {
            "notes": {
                "widgetType": "markdown",
                "schemaVersion": 1,
                "props": {"title": "Read me"},
                "layout": {},
            }
        },
        ["notes"],
    )

    records = diff_canvas_definition(before, after)

    assert summary(records) == [
        ("widget", "add", ["notes"]),
        ("widget", "remove", ["old"]),
    ]
    assert records[0].to_value == {
        "parent": None,
        "widgetType": "markdown",
        "title": "Read me",
    }
    assert records[1].from_value == {"parent": None, "widgetId": "w-1"}


def test_moves_layout_and_props_are_separate_records() -> None:
    nodes: dict[str, dict[str, Any]] = {
        "group": {**GROUP, "children": []},
        "a": {"widgetId": "w-1", "layout": {"colSpan": 6}},
        "b": {"widgetType": "markdown", "schemaVersion": 1, "props": {}},
    }
    before = definition(nodes, ["group", "a", "b"])
    moved = {
        **nodes,
        "group": {**GROUP, "children": ["a"]},
        "a": {"widgetId": "w-1", "layout": {"colSpan": 12}},
        "b": {"widgetType": "markdown", "schemaVersion": 1, "props": {"text": "hi"}},
    }
    after = definition(moved, ["group", "b"])

    assert summary(diff_canvas_definition(before, after)) == [
        ("widget", "move", ["a"]),
        ("layout", "edit", ["a", "layout"]),
        ("widget", "add", ["b", "props", "text"]),
    ]


def test_reordering_siblings_is_a_move_but_a_removal_is_not() -> None:
    nodes = {key: {"widgetId": f"w-{key}", "layout": {}} for key in "abc"}

    reordered = diff_canvas_definition(
        definition(nodes, ["a", "b", "c"]), definition(nodes, ["c", "a", "b"])
    )
    removed = diff_canvas_definition(
        definition(nodes, ["a", "b", "c"]),
        definition({k: v for k, v in nodes.items() if k != "a"}, ["b", "c"]),
    )

    assert summary(reordered) == [("widget", "move", ["c"])]
    assert summary(removed) == [("widget", "remove", ["a"])]


def test_settings_interactions_and_root_layout_are_walked() -> None:
    before = definition({}, [])
    after = definition(
        {},
        [],
        root={"layout": {"columns": 12}, "children": []},
        interactions={"filters": {"f": ["a"]}},
        settings={"refresh": {"interval": 60}},
    )

    assert summary(diff_canvas_definition(before, after)) == [
        ("layout", "edit", ["root", "layout", "columns"]),
        ("interaction", "add", ["interactions", "filters", "f"]),
        ("setting", "edit", ["settings", "refresh", "interval"]),
    ]


def test_an_unchanged_definition_has_no_records() -> None:
    same = definition({"a": {"widgetId": "w-1", "layout": {}}}, ["a"])

    assert diff_canvas_definition(same, same) == []
