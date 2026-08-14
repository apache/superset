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

import pytest

from superset.mcp_service.chart import preview_utils


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


def test_generate_preview_from_form_data_exposes_jinja_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unsaved-chart previews expose the same Jinja inputs as execution."""
    from types import SimpleNamespace
    from typing import Any
    from unittest.mock import MagicMock

    from flask import current_app

    from superset.common.query_object import QueryObject
    from tests.unit_tests.charts.data.form_data_test import (
        assert_request_dependent_jinja_macros,
    )

    query = QueryObject(
        filters=[{"col": "region", "op": "IN", "val": ["North"]}],
        time_range="Last week",
    )
    query_context = SimpleNamespace(
        queries=[query],
        form_data={"url_params": {"tenant": "acme"}},
    )
    observed: dict[str, bool] = {}

    class QueryContextFactory:
        def create(self, **kwargs: Any) -> object:
            return query_context

    class ChartDataCommand:
        def __init__(self, qc: object) -> None:
            self.query_context = qc

        def validate(self) -> None:
            pass

        def run(self) -> dict[str, Any]:
            assert_request_dependent_jinja_macros()
            observed["ran"] = True
            return {
                "queries": [
                    {
                        "data": [{"region": "North"}],
                        "colnames": ["region"],
                        "rowcount": 1,
                    }
                ]
            }

    monkeypatch.setattr(
        "superset.common.query_context_factory.QueryContextFactory",
        QueryContextFactory,
    )
    monkeypatch.setattr(
        "superset.commands.chart.data.get_data_command.ChartDataCommand",
        ChartDataCommand,
    )
    mock_db = MagicMock()
    mock_db.session.get.return_value = MagicMock()
    monkeypatch.setattr("superset.extensions.db", mock_db)

    with current_app.test_request_context():
        result = preview_utils.generate_preview_from_form_data(
            {
                "metrics": ["count"],
                "groupby": ["region"],
                "url_params": {"tenant": "acme"},
                "time_range": "Last week",
            },
            dataset_id=7,
            preview_format="table",
        )

    assert observed["ran"] is True
    assert getattr(result, "error", None) is None
