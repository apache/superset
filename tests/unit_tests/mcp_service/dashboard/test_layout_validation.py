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

"""Tests for MCP dashboard layout validation."""

from copy import deepcopy

from superset.mcp_service.dashboard.layout_validation import (
    validate_dashboard_layout,
)


def _grid_layout() -> dict:
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {
            "children": ["GRID_ID"],
            "id": "ROOT_ID",
            "type": "ROOT",
        },
        "GRID_ID": {
            "children": ["ROW-1"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "ROW-1": {
            "children": ["CHART-1"],
            "id": "ROW-1",
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "ROW",
        },
        "CHART-1": {
            "children": [],
            "id": "CHART-1",
            "meta": {"chartId": 1},
            "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
            "type": "CHART",
        },
    }


def test_valid_layout() -> None:
    assert validate_dashboard_layout(_grid_layout(), {1}) is None


def test_valid_top_level_tabs_with_reserved_nodes() -> None:
    layout = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {
            "children": ["TABS-1"],
            "id": "ROOT_ID",
            "type": "ROOT",
        },
        "GRID_ID": {
            "children": [],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "Tabbed dashboard"},
            "type": "HEADER",
        },
        "TABS-1": {
            "children": ["TAB-1"],
            "id": "TABS-1",
            "parents": ["ROOT_ID"],
            "type": "TABS",
        },
        "TAB-1": {
            "children": ["CHART-1"],
            "id": "TAB-1",
            "parents": ["ROOT_ID", "TABS-1"],
            "type": "TAB",
        },
        "CHART-1": {
            "id": "CHART-1",
            "meta": {"chartId": 1},
            "parents": ["ROOT_ID", "TABS-1", "TAB-1"],
            "type": "CHART",
        },
    }

    assert validate_dashboard_layout(layout, {1}) is None


def test_rejects_unreachable_chart() -> None:
    layout = _grid_layout()
    layout["GRID_ID"]["children"] = []

    error = validate_dashboard_layout(layout, {1})

    assert error == "Layout component ROW-1 is unreachable from ROOT_ID."


def test_rejects_missing_child_reference() -> None:
    layout = _grid_layout()
    del layout["ROW-1"]

    error = validate_dashboard_layout(layout, {1})

    assert error == "Layout references missing component ROW-1."


def test_rejects_cycle() -> None:
    layout = _grid_layout()
    layout["CHART-1"]["type"] = "COLUMN"
    layout["CHART-1"].pop("meta")
    layout["CHART-1"]["children"] = ["ROW-1"]

    error = validate_dashboard_layout(layout, {1})

    assert error == "Layout contains a cycle at ROW-1."


def test_rejects_inconsistent_parents() -> None:
    layout = _grid_layout()
    layout["CHART-1"]["parents"] = ["ROOT_ID", "GRID_ID"]

    error = validate_dashboard_layout(layout, {1})

    assert error == "Layout component CHART-1 has inconsistent parents."


def test_rejects_component_in_invalid_parent() -> None:
    layout = _grid_layout()
    layout["ROW-1"]["type"] = "TABS"

    error = validate_dashboard_layout(layout, {1})

    assert error == "Layout component CHART-1 cannot be a child of ROW-1."


def test_rejects_unsupported_component_type() -> None:
    layout = _grid_layout()
    layout["ROW-1"]["type"] = "UNKNOWN"

    error = validate_dashboard_layout(layout, {1})

    assert error == "Layout component ROW-1 cannot be a child of GRID_ID."


def test_rejects_layout_that_hides_associated_chart() -> None:
    layout = deepcopy(_grid_layout())
    layout["CHART-1"]["meta"]["chartId"] = 2

    error = validate_dashboard_layout(layout, {1, 2})

    assert error == "Layout would hide dashboard charts: [1]."


def test_rejects_chart_not_associated_with_dashboard() -> None:
    error = validate_dashboard_layout(_grid_layout(), set())

    assert error == "Layout references charts not associated with the dashboard: [1]."
