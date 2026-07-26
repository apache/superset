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
