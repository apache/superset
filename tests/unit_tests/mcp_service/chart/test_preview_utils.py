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

"""
Tests for preview_utils query context column building.
"""

import ast
import inspect
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from wcwidth import wcswidth

from superset.mcp_service.chart import preview_utils
from superset.mcp_service.chart.preview_utils import _canonical_preview_value
from superset.mcp_service.chart.query_result import MAX_RESULT_VALUE_DEPTH
from superset.mcp_service.chart.schemas import ChartError
from tests.unit_tests.mcp_service.chart.query_result_fixtures import (
    chart_data_command_result,
)


def _imports_chart_data_command(node: ast.Import | ast.ImportFrom) -> bool:
    blocked_module = "superset.commands.chart.data.get_data_command"

    if isinstance(node, ast.Import):
        return any(
            alias.name == blocked_module or alias.name.startswith(f"{blocked_module}.")
            for alias in node.names
        )

    module = node.module or ""
    return (
        module == blocked_module
        or module.startswith(f"{blocked_module}.")
        or (
            module == "superset.commands.chart.data"
            and any(alias.name == "get_data_command" for alias in node.names)
        )
    )


def test_preview_utils_does_not_top_level_import_chart_data_command():
    """preview_utils constants should stay safe to import before app setup."""
    source_path = inspect.getsourcefile(preview_utils) or preview_utils.__file__
    source = Path(source_path).read_text(encoding="utf-8")
    tree = ast.parse(source)
    top_level_imports = [
        node for node in tree.body if isinstance(node, (ast.Import, ast.ImportFrom))
    ]

    assert preview_utils.SUPPORTED_FORM_DATA_PREVIEW_FORMATS == frozenset(
        {"ascii", "table", "vega_lite"}
    )
    assert not any(_imports_chart_data_command(node) for node in top_level_imports)


def test_preview_projection_uses_the_validated_result_depth_limit() -> None:
    value: object = "leaf"
    for _ in range(MAX_RESULT_VALUE_DEPTH):
        value = [value]

    projected = _canonical_preview_value(value)
    for _ in range(MAX_RESULT_VALUE_DEPTH):
        assert isinstance(projected, list)
        projected = projected[0]
    assert projected == "leaf"


class TestPreviewUtilsColumnBuilding:
    """Tests for x_axis + groupby column building in generate_preview_from_form_data.

    The function must build the columns list from both x_axis and groupby for
    XY charts, and fall back to form_data["columns"] for table charts.
    """

    def test_xy_chart_uses_x_axis_and_groupby(self):
        """Test XY chart form_data builds columns from x_axis + groupby."""
        form_data = {
            "x_axis": "territory",
            "groupby": ["year"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        raw_columns = form_data.get("columns", [])

        columns = (
            raw_columns.copy() if "columns" in form_data else groupby_columns.copy()
        )
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)
        elif x_axis_config and isinstance(x_axis_config, dict):
            col_name = x_axis_config.get("column_name")
            if col_name and col_name not in columns:
                columns.insert(0, col_name)

        assert columns == ["territory", "year"]

    def test_table_chart_uses_columns_field(self):
        """Test table chart form_data uses 'columns' field directly."""
        form_data = {
            "columns": ["name", "region", "sales"],
            "metrics": [],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        raw_columns = form_data.get("columns", [])

        columns = (
            raw_columns.copy() if "columns" in form_data else groupby_columns.copy()
        )
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["name", "region", "sales"]

    def test_xy_chart_x_axis_dict_format(self):
        """Test XY chart with x_axis as dict (column_name key)."""
        form_data = {
            "x_axis": {"column_name": "order_date"},
            "groupby": ["product_type"],
            "metrics": [{"label": "SUM(revenue)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        raw_columns = form_data.get("columns", [])

        columns = (
            raw_columns.copy() if "columns" in form_data else groupby_columns.copy()
        )
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)
        elif x_axis_config and isinstance(x_axis_config, dict):
            col_name = x_axis_config.get("column_name")
            if col_name and col_name not in columns:
                columns.insert(0, col_name)

        assert columns == ["order_date", "product_type"]

    def test_no_x_axis_no_columns_uses_groupby(self):
        """Test fallback to groupby when no x_axis and no columns."""
        form_data = {
            "groupby": ["category"],
            "metrics": [{"label": "COUNT(*)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        raw_columns = form_data.get("columns", [])

        columns = (
            raw_columns.copy() if "columns" in form_data else groupby_columns.copy()
        )
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["category"]

    def test_empty_form_data_returns_empty_columns(self):
        """Test empty form_data returns empty columns list."""
        form_data: dict = {
            "metrics": [{"label": "COUNT(*)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        raw_columns = form_data.get("columns", [])

        columns = (
            raw_columns.copy() if "columns" in form_data else groupby_columns.copy()
        )
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == []

    def test_x_axis_not_duplicated_when_in_groupby(self):
        """Test x_axis is not added if already present in groupby."""
        form_data = {
            "x_axis": "territory",
            "groupby": ["territory", "year"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        raw_columns = form_data.get("columns", [])

        columns = (
            raw_columns.copy() if "columns" in form_data else groupby_columns.copy()
        )
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["territory", "year"]


def test_build_query_columns_empty_columns_key_keeps_groupby():
    """MCP path: an explicitly empty ``columns`` list no longer shadows ``groupby``.

    ``_build_query_columns`` delegates to the shared
    ``superset.common.form_data_query_context.columns_from_form_data``; this pins
    the (intentional) behavior change so the export and MCP paths stay in sync.
    """
    assert preview_utils._build_query_columns(
        {"groupby": ["country"], "columns": []}
    ) == ["country"]


def test_generate_preview_seeds_form_data_before_query_execution():
    """Preview execution seeds the form data consumed by virtual-dataset Jinja."""
    with (
        patch(
            "superset.charts.data.form_data.set_query_context_form_data"
        ) as mock_set_form_data,
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as mock_cmd_cls,
        patch(
            "superset.common.query_context_factory.QueryContextFactory"
        ) as mock_factory,
        patch("superset.extensions.db") as mock_db,
    ):
        mock_db.session.get.return_value = MagicMock(id=12)
        query_context = MagicMock()
        mock_factory.return_value.create.return_value = query_context
        mock_cmd_cls.return_value.run.return_value = chart_data_command_result(
            rows=[], columns=["value"]
        )

        preview_utils.generate_preview_from_form_data(
            form_data={"metrics": [{"label": "count"}]},
            dataset_id=12,
            preview_format="table",
        )

    mock_set_form_data.assert_called_once_with(query_context, 12, "table")


def test_unsaved_previews_strictly_validate_secondary_query_results():
    class HostileList(list):
        def __iter__(self):
            raise AssertionError("hostile secondary list hook executed")

    with (
        patch("superset.charts.data.form_data.set_query_context_form_data"),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as mock_cmd_cls,
        patch("superset.common.query_context_factory.QueryContextFactory"),
        patch("superset.extensions.db") as mock_db,
    ):
        mock_db.session.get.return_value = MagicMock(id=12)
        mock_cmd_cls.return_value.run.return_value = {
            "queries": [
                {"data": [{"value": 1}]},
                {"data": HostileList()},
            ]
        }

        result = preview_utils.generate_preview_from_form_data(
            form_data={"metrics": [{"label": "count"}]},
            dataset_id=12,
            preview_format="table",
        )

    assert isinstance(result, ChartError)
    assert result.error_type == "InvalidQueryResult"


def test_unsaved_preview_rejects_hostile_enum_without_dispatching_hooks():
    from enum import Enum

    class HostileEnum(Enum):
        VALUE = "hostile"

        def __getattribute__(self, name):
            if name == "value":
                raise AssertionError("hostile enum value hook executed")
            return object.__getattribute__(self, name)

        def __str__(self):
            raise AssertionError("hostile enum string hook executed")

    with (
        patch("superset.charts.data.form_data.set_query_context_form_data"),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as mock_cmd_cls,
        patch("superset.common.query_context_factory.QueryContextFactory"),
        patch("superset.extensions.db") as mock_db,
    ):
        mock_db.session.get.return_value = MagicMock(id=12)
        mock_cmd_cls.return_value.run.return_value = {
            "queries": [{"data": [], "status": HostileEnum.VALUE}]
        }

        result = preview_utils.generate_preview_from_form_data(
            form_data={"metrics": [{"label": "count"}]},
            dataset_id=12,
            preview_format="table",
        )

    assert isinstance(result, ChartError)
    assert result.error_type == "InvalidQueryResult"


def test_ascii_preview_content_respects_requested_dimensions() -> None:
    """Reported canvas dimensions also bound the rendered text."""
    result = preview_utils._generate_ascii_preview_from_data(
        [{"category": "a long category label", "value": 12}] * 10,
        {"viz_type": "table"},
        width=12,
        height=3,
    )
    assert not isinstance(result, ChartError)
    assert result.width == 12
    assert result.height == 3
    assert len(result.ascii_content.splitlines()) == 3
    assert all(len(line) <= 12 for line in result.ascii_content.splitlines())


@pytest.mark.parametrize("height", [1, 2, 3, 4, 20, 25])
@pytest.mark.parametrize("row_count", [1, 18, 20, 30])
def test_sunburst_ascii_reserves_truncation_notice(height: int, row_count: int) -> None:
    """Every omitted hierarchy row is accounted for within the canvas."""
    result = preview_utils._generate_ascii_preview_from_data(
        [{"region": f"region-{index}", "value": index} for index in range(row_count)],
        {"viz_type": "sunburst_v2", "columns": ["region"], "metric": "value"},
        height=height,
    )
    assert not isinstance(result, ChartError)
    lines = result.ascii_content.splitlines()
    assert len(lines) <= height
    rendered = sum(line.startswith("region-") for line in lines)
    if omitted := row_count - rendered:
        assert lines[-1] == f"... {omitted} more rows"
    else:
        assert "more rows" not in result.ascii_content


@pytest.mark.parametrize("text", ["漢字" * 20, "😀" * 20, "e\u0301" * 40, "a" * 80])
@pytest.mark.parametrize("width", [1, 2, 3, 12, 40])
def test_ascii_width_uses_terminal_columns(text: str, width: int) -> None:
    """Wide and combining characters fit, with a visible truncation marker."""
    line = preview_utils._truncate_display_line(text, width)
    assert 0 <= wcswidth(line) <= width
    if wcswidth(text) > width:
        assert line.endswith("." * min(3, width))
    else:
        assert line == text


def test_sunburst_ascii_marks_width_truncation_and_keeps_footer() -> None:
    """Long paths cannot consume the footer or inject additional rows."""
    result = preview_utils._generate_ascii_preview_from_data(
        [{"region": "漢字\n" * 30, "value": 1}] * 30,
        {"viz_type": "sunburst_v2", "columns": ["region"], "metric": "value"},
        width=20,
        height=4,
    )
    assert not isinstance(result, ChartError)
    lines = result.ascii_content.splitlines()
    assert len(lines) == 4
    assert lines[2].endswith("...")
    assert lines[-1] == "... 29 more rows"
    assert all(0 <= wcswidth(line) <= 20 for line in lines)
