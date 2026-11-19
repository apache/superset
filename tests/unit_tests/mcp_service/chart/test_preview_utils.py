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
from decimal import Decimal
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from wcwidth import wcswidth

from superset.mcp_service.chart import preview_utils
from superset.mcp_service.chart.preview_utils import _canonical_preview_value
from superset.mcp_service.chart.query_result import MAX_RESULT_VALUE_DEPTH
from superset.mcp_service.chart.schemas import ChartError, TablePreview, VegaLitePreview
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

    def test_xy_chart_uses_x_axis_and_groupby(self) -> None:
        """Test XY chart form_data builds columns from x_axis + groupby."""
        form_data = {
            "x_axis": "territory",
            "groupby": ["year"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        columns = preview_utils._build_query_columns(form_data)

        assert columns == ["territory", "year"]

    def test_table_chart_uses_columns_field(self) -> None:
        """Test table chart form_data uses 'columns' field directly."""
        form_data = {
            "columns": ["name", "region", "sales"],
            "metrics": [],
        }

        columns = preview_utils._build_query_columns(form_data)

        assert columns == ["name", "region", "sales"]

    def test_xy_chart_x_axis_dict_format(self) -> None:
        """Test XY chart with x_axis as dict (column_name key)."""
        form_data = {
            "x_axis": {"column_name": "order_date"},
            "groupby": ["product_type"],
            "metrics": [{"label": "SUM(revenue)"}],
        }

        columns = preview_utils._build_query_columns(form_data)

        assert columns == ["order_date", "product_type"]

    def test_no_x_axis_no_columns_uses_groupby(self) -> None:
        """Test fallback to groupby when no x_axis and no columns."""
        form_data = {
            "groupby": ["category"],
            "metrics": [{"label": "COUNT(*)"}],
        }

        columns = preview_utils._build_query_columns(form_data)

        assert columns == ["category"]

    def test_empty_form_data_returns_empty_columns(self) -> None:
        """Test empty form_data returns empty columns list."""
        form_data = {
            "metrics": [{"label": "COUNT(*)"}],
        }

        columns = preview_utils._build_query_columns(form_data)

        assert columns == []

    def test_x_axis_not_duplicated_when_in_groupby(self) -> None:
        """Test x_axis is not added if already present in groupby."""
        form_data = {
            "x_axis": "territory",
            "groupby": ["territory", "year"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        columns = preview_utils._build_query_columns(form_data)

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


def test_generate_preview_seeds_form_data_before_query_execution() -> None:
    """Unsaved previews expose fresh Jinja inputs before constructing the command."""
    from types import SimpleNamespace

    from flask import current_app, g

    from superset.jinja_context import ExtraCache

    form_data = {
        "viz_type": "table",
        "metrics": ["count"],
        "url_params": {"tenant": "acme"},
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "region",
                "operator": "==",
                "comparator": "EMEA",
            }
        ],
    }

    def build_context(
        query_form_data: dict[str, object], **kwargs: object
    ) -> SimpleNamespace:
        """Keep the builder boundary isolated but serialize real macro inputs."""
        return SimpleNamespace(
            form_data=query_form_data,
            queries=[
                SimpleNamespace(
                    to_dict=lambda: {"columns": [], "metrics": ["count"]},
                    filter=[{"col": "region", "op": "==", "val": "EMEA"}],
                    time_range=None,
                )
            ],
        )

    def build_command(query_context: object) -> MagicMock:
        """Inspect actual seeded macro values at command construction, before run."""
        cache = ExtraCache()
        assert cache.filter_values("region") == ["EMEA"]
        assert cache.url_param("tenant", escape_result=False) == "acme"
        assert g.form_data["datasource"] == {"id": 12, "type": "table"}
        command = MagicMock()
        command.run.return_value = chart_data_command_result(
            rows=[{"count": 2}], columns=["count"]
        )
        return command

    with (
        current_app.test_request_context(),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            side_effect=build_command,
        ),
        patch(
            "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data",
            side_effect=build_context,
        ),
        patch("superset.extensions.db") as mock_db,
    ):
        g.form_data = {"url_params": {"tenant": "stale"}, "adhoc_filters": []}
        mock_db.session.get.return_value = MagicMock(id=12)
        preview = preview_utils.generate_preview_from_form_data(
            form_data=form_data,
            dataset_id=12,
            preview_format="table",
        )
        assert isinstance(preview, TablePreview)
        assert preview.row_count == 1
        assert "count" in preview.table_data
        assert "2" in preview.table_data


@pytest.mark.parametrize("time_grain", [None, "P1D", "P1M"])
def test_unsaved_big_number_preview_uses_temporal_query_contract(
    time_grain: str | None,
) -> None:
    """Native axes retain bucketing and the independently selected range column."""
    form_data = {
        "viz_type": "big_number",
        "x_axis": {"column_name": "recorded_at"},
        "granularity_sqla": "event_time",
        "time_grain_sqla": time_grain,
        "metric": "count",
        "show_trend_line": True,
        "time_range": "Last week",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "region",
                "operator": "==",
                "comparator": "EMEA",
            }
        ],
    }
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ),
        patch("superset.extensions.db.session.get", return_value=object()),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
        patch("superset.common.query_context_factory.QueryContextFactory") as factory,
    ):
        factory.return_value.create.return_value = MagicMock()
        command.return_value.run.return_value = {
            "queries": [{"status": "success", "data": []}]
        }

        result = preview_utils.generate_preview_from_form_data(form_data, 1, "table")

    assert isinstance(result, TablePreview)
    query = factory.return_value.create.call_args.kwargs["queries"][0]
    assert query["columns"][0]["sqlExpression"] == "recorded_at"
    assert query["columns"][0].get("timeGrain") == time_grain
    assert query["granularity"] == "event_time"
    assert query.get("extras", {}).get("time_grain_sqla") == time_grain
    assert query["metrics"] == ["count"]
    assert query["time_range"] == "Last week"
    assert query["filters"] == [{"col": "region", "op": "==", "val": "EMEA"}]
    assert query["row_limit"] == 100


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


def test_histogram_preview_uses_postprocessed_bins() -> None:
    """The histogram preview must not bin or count already aggregated bin counts."""
    result = preview_utils._generate_vega_lite_preview_from_data(
        [{"0 - 10": 4, "10 - 20": 7}], {"viz_type": "histogram_v2"}
    )
    assert result.specification["data"]["values"] == [
        {"bin": "0 - 10", "value": 4, "series": "All"},
        {"bin": "10 - 20", "value": 7, "series": "All"},
    ]
    encoding = result.specification["encoding"]
    assert encoding["x"]["field"] == "bin"
    assert "bin" not in encoding["x"]
    assert encoding["y"]["field"] == "value"
    assert "aggregate" not in encoding["y"]


@pytest.mark.parametrize("viz_type", ["sankey_v2", "radar"])
def test_vega_preview_rejects_unsupported_native_geometry(viz_type: str) -> None:
    """Unsupported geometry must not silently become an unrelated scatter plot."""
    result = preview_utils._generate_vega_lite_preview_from_data(
        [{"source": "A", "target": "B", "value": 10}], {"viz_type": viz_type}
    )
    assert result.error_type == "UnsupportedFormat"
    assert "Explore" in result.error


def test_funnel_preview_binds_stage_and_metric() -> None:
    """A funnel preview must encode its stages and values rather than a scatter."""
    result = preview_utils._generate_vega_lite_preview_from_data(
        [{"stage": "Won", "SUM(value)": 10}],
        {"viz_type": "funnel", "groupby": ["stage"], "metric": "SUM(value)"},
    )
    spec = result.specification
    assert spec["mark"] == "bar"
    assert spec["encoding"]["y"]["field"] == "stage"
    assert spec["encoding"]["x"]["field"] == "SUM(value)"


@pytest.mark.parametrize("stage", [None, 42, {}, {"expressionType": "SQL"}])
def test_funnel_preview_rejects_invalid_stage(stage: object) -> None:
    """Malformed stage references return the invalid-form-data contract."""
    from superset.mcp_service.chart.schemas import ChartError

    result = preview_utils.generate_funnel_vega_lite_preview(
        [], {"groupby": [stage], "metric": "count"}
    )

    assert isinstance(result, ChartError)
    assert result.error_type == "InvalidFormData"


@pytest.mark.parametrize(
    "stage", ["stage", {"label": "stage"}, {"sqlExpression": "stage"}]
)
def test_funnel_preview_resolves_stage(stage: object) -> None:
    """Valid stage references retain their result labels."""
    from superset.mcp_service.chart.schemas import VegaLitePreview

    result = preview_utils.generate_funnel_vega_lite_preview(
        [{"stage": "visit", "count": 3}], {"groupby": [stage], "metric": "count"}
    )

    assert isinstance(result, VegaLitePreview)
    assert result.specification["encoding"]["y"]["field"] == "stage"


def _vega_encoding(rows, form_data):
    result = preview_utils._generate_vega_lite_preview_from_data(rows, form_data)
    return result.specification.get("encoding", {})


def test_vega_preview_y_axis_uses_metric_not_boolean_x():
    rows = [
        {"is_active": True, "revenue": 10.5},
        {"is_active": False, "revenue": 3.0},
    ]
    encoding = _vega_encoding(
        rows,
        {
            "viz_type": "echarts_timeseries_bar",
            "x_axis": "is_active",
            "metrics": [{"label": "revenue", "expressionType": "SQL"}],
        },
    )

    assert encoding["x"]["field"] == "is_active"
    assert encoding["y"]["field"] == "revenue"


def test_vega_preview_y_axis_uses_first_matching_metric_of_many():
    rows = [{"flag": True, "count": 4, "SUM(amount)": 7.0, "AVG(price)": 2.5}]
    encoding = _vega_encoding(
        rows,
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": "flag",
            "metrics": [
                {
                    "expressionType": "SIMPLE",
                    "aggregate": "AVG",
                    "column": {"column_name": "price"},
                },
                {
                    "expressionType": "SIMPLE",
                    "aggregate": "SUM",
                    "column": {"column_name": "amount"},
                },
            ],
        },
    )

    assert encoding["y"]["field"] == "AVG(price)"


def test_vega_preview_y_axis_falls_back_when_no_metric_label_matches():
    rows = [{"flag": True, "name": "a", "value": 3}]
    encoding = _vega_encoding(
        rows,
        {"viz_type": "bar", "x_axis": "name", "metrics": ["missing_metric"]},
    )

    # Boolean columns are skipped; the first numeric column is used.
    assert encoding["y"]["field"] == "value"


def test_vega_preview_without_metrics_has_no_y_axis():
    rows = [{"flag": True, "name": "a", "value": 3}]
    encoding = _vega_encoding(rows, {"viz_type": "bar", "x_axis": "name"})

    assert encoding["x"]["field"] == "name"
    assert "y" not in encoding


@pytest.mark.parametrize("value", ["ready", True, False])
def test_vega_preview_y_axis_skips_nonnumeric_metrics(value: str | bool) -> None:
    """Quantitative y encodings must not use string or boolean metrics."""
    encoding = _vega_encoding(
        [{"invalid": value, "revenue": 7}],
        {"viz_type": "bar", "metrics": ["invalid", "revenue"]},
    )

    assert encoding["y"]["field"] == "revenue"


@pytest.mark.parametrize("value", ["ready", True])
def test_vega_preview_y_axis_omits_invalid_only_metric(value: str | bool) -> None:
    """A matched invalid metric must not fall back to a numeric dimension."""
    encoding = _vega_encoding(
        [{"year": 2026, "total_status": value}],
        {"viz_type": "bar", "x_axis": "year", "metrics": ["total_status"]},
    )

    assert "y" not in encoding


@pytest.mark.parametrize(
    "column,value", [("summary", "ready"), ("maximum_status", True)]
)
def test_vega_preview_y_axis_fallback_requires_numeric_value(
    column: str, value: str | bool
) -> None:
    """Aggregation substrings do not make dimension values quantitative."""
    encoding = _vega_encoding(
        [{column: value, "revenue": 7}],
        {"viz_type": "bar", "x_axis": column, "metrics": ["missing"]},
    )

    assert encoding["y"]["field"] == "revenue"


def test_vega_preview_y_axis_preserves_null_metric() -> None:
    """A null first metric value does not change the configured y field."""
    encoding = _vega_encoding(
        [{"year": 2026, "revenue": None}, {"year": 2027, "revenue": 7}],
        {"viz_type": "bar", "x_axis": "year", "metrics": ["revenue"]},
    )

    assert encoding["y"]["field"] == "revenue"


def test_vega_preview_y_axis_fallback_accepts_decimal() -> None:
    """A Decimal in a non-metric column is a valid fallback y-axis."""
    encoding = _vega_encoding(
        [{"flag": True, "name": "a", "revenue": Decimal("7.25")}],
        {"viz_type": "bar", "x_axis": "name", "metrics": ["missing"]},
    )

    assert encoding["y"]["field"] == "revenue"


@pytest.mark.parametrize(
    ("viz_type", "form_data", "expects_empty_preview"),
    [
        (
            "bubble_v2",
            {"entity": "name", "x": "x_metric", "y": "y_metric", "size": "size"},
            True,
        ),
        ("gauge_chart", {"metric": "count"}, True),
        ("bar", {"x_axis": "region", "metrics": ["count"]}, False),
        (
            "gantt_chart",
            {"start_time": "start_time", "end_time": "end_time", "y_axis": "task"},
            True,
        ),
    ],
)
def test_unsaved_vega_preview_empty_result_honors_allows_empty_result(
    viz_type: str, form_data: dict[str, Any], expects_empty_preview: bool
) -> None:
    """Unsaved previews reject empty results unless the plugin allows them."""
    with (
        patch("superset.extensions.db.session.get", return_value=object()),
        patch(
            "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data",
            return_value=MagicMock(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
    ):
        command.return_value.run.return_value = chart_data_command_result([])
        preview = preview_utils.generate_preview_from_form_data(
            {**form_data, "viz_type": viz_type}, 1, "vega_lite"
        )

    if expects_empty_preview:
        assert isinstance(preview, VegaLitePreview)
        assert preview.specification["data"]["values"] == []
    else:
        assert isinstance(preview, ChartError)
        assert preview.error_type == "NoDataError"
