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

from typing import Any

from superset.dashboards.layout import remove_unreachable_components


def reachable_position() -> dict[str, Any]:
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["ROW-a"]},
        "ROW-a": {"id": "ROW-a", "type": "ROW", "children": ["CHART-a"]},
        "CHART-a": {"id": "CHART-a", "type": "CHART", "children": []},
        "HEADER_ID": {"id": "HEADER_ID", "type": "HEADER"},
    }


def test_intact_layout_is_returned_unchanged() -> None:
    position = reachable_position()

    assert remove_unreachable_components(position) == (position, [])


def test_detached_subtree_with_a_cycle_is_removed() -> None:
    # the shape of the reported corruption: a column moved into a row nested
    # inside itself, leaving the pair pointing at each other and detached
    position = reachable_position() | {
        "COLUMN-orphan": {
            "id": "COLUMN-orphan",
            "type": "COLUMN",
            "children": ["CHART-trapped", "ROW-orphan"],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-a"],
        },
        "ROW-orphan": {
            "id": "ROW-orphan",
            "type": "ROW",
            "children": ["COLUMN-orphan"],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-a", "COLUMN-orphan"],
        },
        "CHART-trapped": {
            "id": "CHART-trapped",
            "type": "CHART",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-a", "COLUMN-orphan"],
        },
    }

    cleaned, removed = remove_unreachable_components(position)

    assert cleaned == reachable_position()
    assert sorted(removed) == ["CHART-trapped", "COLUMN-orphan", "ROW-orphan"]


def test_detached_grid_of_a_tabbed_dashboard_is_kept() -> None:
    position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["TABS-t"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": []},
        "TABS-t": {"id": "TABS-t", "type": "TABS", "children": ["TAB-1"]},
        "TAB-1": {"id": "TAB-1", "type": "TAB", "children": []},
        "HEADER_ID": {"id": "HEADER_ID", "type": "HEADER"},
    }

    assert remove_unreachable_components(position) == (position, [])


def test_layout_without_a_root_is_left_alone() -> None:
    position = {"ROW-a": {"id": "ROW-a", "type": "ROW", "children": []}}

    assert remove_unreachable_components(position) == (position, [])


def test_missing_child_reference_does_not_raise() -> None:
    position = reachable_position()
    position["ROW-a"]["children"] = ["CHART-a", "CHART-does-not-exist"]

    assert remove_unreachable_components(position) == (position, [])
