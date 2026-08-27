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
from pathlib import Path
from typing import Any

import yaml

from superset.mcp_service.dashboard.layout_validation import (
    validate_dashboard_layout,
)


def _grid_layout() -> dict[str, Any]:
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
            "meta": {},
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


def test_valid_empty_grid() -> None:
    layout = _grid_layout()
    layout["GRID_ID"]["children"] = []
    del layout["ROW-1"]
    del layout["CHART-1"]

    assert validate_dashboard_layout(layout, set()) is None


def test_accepts_decimal_string_chart_id() -> None:
    layout = _grid_layout()
    layout["CHART-1"]["meta"]["chartId"] = "1"

    assert validate_dashboard_layout(layout, {1}) is None


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
            "meta": {},
            "parents": ["ROOT_ID"],
            "type": "TABS",
        },
        "TAB-1": {
            "children": ["CHART-1"],
            "id": "TAB-1",
            "meta": {"text": "Overview"},
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
    layout["GRID_ID"]["children"] = []
    layout["ROW-1"]["children"] = ["COLUMN-1"]
    layout["ROW-1"]["parents"] = ["COLUMN-1"]
    layout["COLUMN-1"] = {
        "children": ["ROW-1"],
        "id": "COLUMN-1",
        "meta": {},
        "parents": ["ROW-1"],
        "type": "COLUMN",
    }

    error = validate_dashboard_layout(layout, {1})

    assert error == "Layout contains a cycle at ROW-1."


def test_accepts_stale_parents_metadata() -> None:
    layout = _grid_layout()
    layout["CHART-1"]["parents"] = ["ROOT_ID", "GRID_ID"]

    assert validate_dashboard_layout(layout, {1}) is None


def test_accepts_missing_parents_metadata() -> None:
    layout = _grid_layout()
    del layout["GRID_ID"]["parents"]
    del layout["CHART-1"]["parents"]

    assert validate_dashboard_layout(layout, {1}) is None


def test_accepts_saved_example_layout_with_stale_parents() -> None:
    fixture_path = (
        Path(__file__).parents[4]
        / "superset"
        / "examples"
        / "video_game_sales"
        / "dashboard.yaml"
    )
    with fixture_path.open(encoding="utf-8") as fixture:
        layout = yaml.safe_load(fixture)["position"]
    chart_ids = {
        component["meta"]["chartId"]
        for component in layout.values()
        if isinstance(component, dict) and component.get("type") == "CHART"
    }

    assert validate_dashboard_layout(layout, chart_ids) is None


def test_rejects_component_in_invalid_parent() -> None:
    layout = _grid_layout()
    layout["ROW-1"]["type"] = "TABS"

    error = validate_dashboard_layout(layout, {1})

    assert error == "Layout component CHART-1 cannot be a child of ROW-1."


def test_rejects_unsupported_component_type() -> None:
    layout = _grid_layout()
    layout["ROW-1"]["type"] = "UNKNOWN"

    error = validate_dashboard_layout(layout, {1})

    assert error == "Layout component ROW-1 has unsupported type."


def test_rejects_layout_that_hides_associated_chart() -> None:
    layout = deepcopy(_grid_layout())
    layout["CHART-1"]["meta"]["chartId"] = 2

    error = validate_dashboard_layout(layout, {1, 2})

    assert error == "Layout would hide dashboard charts: [1]."


def test_rejects_chart_not_associated_with_dashboard() -> None:
    error = validate_dashboard_layout(_grid_layout(), set())

    assert error == "Layout references charts not associated with the dashboard: [1]."


def test_rejects_empty_root() -> None:
    layout = _grid_layout()
    layout["ROOT_ID"]["children"] = []

    assert validate_dashboard_layout(layout, {1}) == (
        "ROOT_ID must contain exactly one GRID or TABS component."
    )


def test_rejects_empty_tabs() -> None:
    layout = _grid_layout()
    layout["ROOT_ID"]["children"] = ["TABS-1"]
    layout["TABS-1"] = {
        "children": [],
        "id": "TABS-1",
        "meta": {},
        "parents": ["ROOT_ID"],
        "type": "TABS",
    }

    assert validate_dashboard_layout(layout, {1}) == (
        "Tabs component TABS-1 must contain at least one tab."
    )


def test_rejects_non_component_top_level_value() -> None:
    layout = _grid_layout()
    layout["BROKEN"] = None

    assert validate_dashboard_layout(layout, {1}) == (
        "Layout value BROKEN must be a component object."
    )


def test_rejects_invalid_version() -> None:
    layout = _grid_layout()
    layout["DASHBOARD_VERSION_KEY"] = None

    assert validate_dashboard_layout(layout, {1}) == (
        "DASHBOARD_VERSION_KEY must be the string 'v2'."
    )


def test_rejects_missing_renderer_metadata() -> None:
    layout = _grid_layout()
    del layout["ROW-1"]["meta"]

    assert validate_dashboard_layout(layout, {1}) == (
        "Layout component ROW-1.meta must be an object."
    )


def test_rejects_dynamic_component() -> None:
    layout = _grid_layout()
    layout["CHART-1"]["type"] = "DYNAMIC"
    layout["CHART-1"]["meta"] = {"componentKey": "unknown"}

    assert validate_dashboard_layout(layout, set()) == (
        "Layout component CHART-1 uses DYNAMIC, which cannot be safely "
        "validated by the server."
    )


def test_rejects_malformed_string_chart_id() -> None:
    layout = _grid_layout()
    layout["CHART-1"]["meta"]["chartId"] = "1.0"

    assert validate_dashboard_layout(layout, {1}) == (
        "Chart component CHART-1 must have a positive integer or "
        "decimal-string chartId."
    )


def test_rejects_leading_zero_string_chart_id() -> None:
    # ``remove_chart_from_dashboard`` cleans json_metadata by ``str(chart_id)``,
    # so accepting "001" here would let a chart be detached while stale "001"
    # references survive in expanded_slices and timed_refresh_immune_slices.
    layout = _grid_layout()
    layout["CHART-1"]["meta"]["chartId"] = "001"

    assert validate_dashboard_layout(layout, {1}) == (
        "Chart component CHART-1 must have a positive integer or "
        "decimal-string chartId."
    )


def test_rejects_oversized_string_chart_id() -> None:
    # Guards CPython's integer string conversion limit: an unbounded int()
    # would raise ValueError out of the tool instead of returning an error.
    layout = _grid_layout()
    layout["CHART-1"]["meta"]["chartId"] = "9" * 10_000

    assert validate_dashboard_layout(layout, {1}) == (
        "Chart component CHART-1 must have a positive integer or "
        "decimal-string chartId."
    )


def test_rejects_nesting_beyond_frontend_depth_limit() -> None:
    # isValidChild.ts caps COLUMN > ROW at a parent depth of three. Nesting
    # ROW > COLUMN > ROW > COLUMN > ROW pushes the innermost COLUMN past it.
    layout = _grid_layout()
    layout["ROW-1"]["children"] = ["COLUMN-1"]
    layout["COLUMN-1"] = {
        "children": ["ROW-2"],
        "id": "COLUMN-1",
        "meta": {},
        "type": "COLUMN",
    }
    layout["ROW-2"] = {
        "children": ["COLUMN-2"],
        "id": "ROW-2",
        "meta": {},
        "type": "ROW",
    }
    layout["COLUMN-2"] = {
        "children": ["ROW-3"],
        "id": "COLUMN-2",
        "meta": {},
        "type": "COLUMN",
    }
    layout["ROW-3"] = {
        "children": ["CHART-1"],
        "id": "ROW-3",
        "meta": {},
        "type": "ROW",
    }

    assert validate_dashboard_layout(layout, {1}) == (
        "Layout component ROW-3 is nested too deeply under COLUMN-2."
    )


def test_accepts_maximum_supported_nesting_depth() -> None:
    # The deepest arrangement isValidChild.ts documents as valid:
    # root > grid > row > column > row > chart.
    layout = _grid_layout()
    layout["ROW-1"]["children"] = ["COLUMN-1"]
    layout["COLUMN-1"] = {
        "children": ["ROW-2"],
        "id": "COLUMN-1",
        "meta": {},
        "type": "COLUMN",
    }
    layout["ROW-2"] = {
        "children": ["CHART-1"],
        "id": "ROW-2",
        "meta": {},
        "type": "ROW",
    }

    assert validate_dashboard_layout(layout, {1}) is None


def test_accepts_tabs_without_consuming_depth() -> None:
    # TABS and TAB render children at their own depth, so a tab-wrapped row
    # must remain valid at the depth its enclosing container already had.
    layout = _grid_layout()
    layout["GRID_ID"]["children"] = ["TABS-1"]
    layout["TABS-1"] = {
        "children": ["TAB-1"],
        "id": "TABS-1",
        "meta": {},
        "type": "TABS",
    }
    layout["TAB-1"] = {
        "children": ["ROW-1"],
        "id": "TAB-1",
        "meta": {},
        "type": "TAB",
    }

    assert validate_dashboard_layout(layout, {1}) is None
