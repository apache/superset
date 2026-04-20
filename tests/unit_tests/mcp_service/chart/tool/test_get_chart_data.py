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
Tests for the get_chart_data request schema and chart type fallback handling.
"""

from typing import Any

import pytest

from superset.mcp_service.chart.schemas import GetChartDataRequest


def _collect_groupby_extras(
    form_data: dict[str, Any],
    groupby_columns: list[str],
) -> None:
    """Append entity/series/columns from form_data into groupby_columns."""
    entity = form_data.get("entity")
    if entity and entity not in groupby_columns:
        groupby_columns.append(entity)
    series = form_data.get("series")
    if series and series not in groupby_columns:
        groupby_columns.append(series)
    form_columns = form_data.get("columns")
    if form_columns and isinstance(form_columns, list):
        for col in form_columns:
            if isinstance(col, str) and col not in groupby_columns:
                groupby_columns.append(col)


def _extract_bubble(
    form_data: dict[str, Any],
) -> tuple[list[Any], list[str]]:
    """Extract metrics and groupby for bubble charts."""
    metrics: list[Any] = []
    for field in ("x", "y", "size"):
        m = form_data.get(field)
        if m:
            metrics.append(m)
    entity = form_data.get("entity")
    groupby: list[str] = [entity] if entity else []
    series_field = form_data.get("series")
    if series_field and series_field not in groupby:
        groupby.append(series_field)
    return metrics, groupby


_SINGULAR_METRIC_NO_GROUPBY = (
    "big_number",
    "big_number_total",
    "pop_kpi",
)
_SINGULAR_METRIC_TYPES = (
    *_SINGULAR_METRIC_NO_GROUPBY,
    "world_map",
    "treemap_v2",
    "sunburst_v2",
    "gauge_chart",
)


def _extract_metrics_and_groupby(
    form_data: dict[str, Any],
) -> tuple[list[Any], list[str]]:
    """Mirror the fallback metric/groupby extraction logic from get_chart_data.py."""
    viz_type = form_data.get("viz_type", "")

    groupby_columns: list[str]
    if viz_type == "bubble":
        metrics, groupby_columns = _extract_bubble(form_data)
    elif viz_type in _SINGULAR_METRIC_TYPES:
        metric = form_data.get("metric")
        metrics = [metric] if metric else []
        if viz_type in _SINGULAR_METRIC_NO_GROUPBY:
            groupby_columns = []
        else:
            groupby_columns = list(form_data.get("groupby") or [])
            _collect_groupby_extras(form_data, groupby_columns)
    else:
        metrics = form_data.get("metrics", [])
        groupby_columns = list(form_data.get("groupby") or [])
        if not groupby_columns:
            form_columns = form_data.get("columns")
            if form_columns and isinstance(form_columns, list):
                groupby_columns = [c for c in form_columns if isinstance(c, str)]

    # Fallback: try singular metric if metrics still empty
    if not metrics:
        fallback_metric = form_data.get("metric")
        if fallback_metric:
            metrics = [fallback_metric]

    # Fallback: try entity/series if groupby still empty
    if not groupby_columns:
        _collect_groupby_extras(form_data, groupby_columns)

    return metrics, groupby_columns


class TestBigNumberChartFallback:
    """Tests for big_number chart fallback query construction."""

    def test_big_number_uses_singular_metric(self):
        """Test that big_number charts use 'metric' (singular) from form_data."""
        form_data = {
            "metric": {"label": "Count", "expressionType": "SIMPLE", "column": None},
            "viz_type": "big_number",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Count"

    def test_big_number_total_uses_singular_metric(self):
        """Test that big_number_total charts use 'metric' (singular)."""
        form_data = {
            "metric": {"label": "Total Sales", "expressionType": "SQL"},
            "viz_type": "big_number_total",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Total Sales"

    def test_big_number_empty_metric_returns_empty_list(self):
        """Test handling of big_number chart with no metric configured."""
        form_data = {
            "metric": None,
            "viz_type": "big_number",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 0

    def test_big_number_no_groupby_columns(self):
        """Test that big_number charts don't have groupby columns."""
        form_data = {
            "metric": {"label": "Count"},
            "viz_type": "big_number",
            "groupby": ["should_be_ignored"],  # This should be ignored
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert groupby == []

    def test_standard_chart_uses_plural_metrics(self):
        """Test that non-big_number charts use 'metrics' (plural)."""
        form_data = {
            "metrics": [
                {"label": "Sum of Sales"},
                {"label": "Avg of Quantity"},
            ],
            "groupby": ["region", "category"],
            "viz_type": "table",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 2
        assert len(groupby) == 2

    def test_viz_type_detection_for_single_metric_charts(self):
        """Test viz_type detection handles all single-metric chart types."""
        singular_metric_types = (
            "big_number",
            "big_number_total",
            "pop_kpi",
            "world_map",
            "treemap_v2",
            "sunburst_v2",
            "gauge_chart",
        )

        for viz_type in singular_metric_types:
            form_data = {
                "metric": {"label": "test_metric"},
                "viz_type": viz_type,
            }
            metrics, _ = _extract_metrics_and_groupby(form_data)
            assert len(metrics) == 1, f"{viz_type} should extract singular metric"

        # Verify standard chart types don't use singular metric path
        other_types = ["table", "line", "bar", "pie", "echarts_timeseries"]
        for viz_type in other_types:
            form_data = {
                "metric": {"label": "should_be_ignored"},
                "metrics": [{"label": "plural_metric"}],
                "viz_type": viz_type,
            }
            metrics, _ = _extract_metrics_and_groupby(form_data)
            assert metrics == [{"label": "plural_metric"}], (
                f"{viz_type} should use plural metrics"
            )

    def test_pop_kpi_uses_singular_metric(self):
        """Test that pop_kpi (BigNumberPeriodOverPeriod) uses singular metric."""
        form_data = {
            "metric": {"label": "Period Comparison", "expressionType": "SQL"},
            "viz_type": "pop_kpi",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Period Comparison"
        assert groupby == []


class TestWorldMapChartFallback:
    """Tests for world_map chart fallback query construction."""

    def test_world_map_uses_singular_metric(self):
        """Test that world_map charts use 'metric' (singular)."""
        form_data = {
            "metric": {"label": "Population"},
            "entity": "country_code",
            "viz_type": "world_map",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Population"

    def test_world_map_extracts_entity_as_groupby(self):
        """Test that world_map entity field becomes groupby."""
        form_data = {
            "metric": {"label": "Population"},
            "entity": "country_code",
            "viz_type": "world_map",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert "country_code" in groupby

    def test_world_map_extracts_series(self):
        """Test that world_map series field is added to groupby."""
        form_data = {
            "metric": {"label": "Population"},
            "entity": "country_code",
            "series": "region",
            "viz_type": "world_map",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert "country_code" in groupby
        assert "region" in groupby


class TestTreemapAndSunburstFallback:
    """Tests for treemap_v2 and sunburst_v2 chart fallback query construction."""

    def test_treemap_v2_uses_singular_metric(self):
        """Test that treemap_v2 charts use 'metric' (singular)."""
        form_data = {
            "metric": {"label": "Revenue"},
            "groupby": ["category", "sub_category"],
            "viz_type": "treemap_v2",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Revenue"
        assert groupby == ["category", "sub_category"]

    def test_sunburst_v2_uses_singular_metric(self):
        """Test that sunburst_v2 charts use 'metric' (singular)."""
        form_data = {
            "metric": {"label": "Count"},
            "columns": ["level1", "level2", "level3"],
            "viz_type": "sunburst_v2",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Count"
        # columns should be picked up as groupby alternatives
        assert "level1" in groupby
        assert "level2" in groupby
        assert "level3" in groupby

    def test_treemap_with_columns_field(self):
        """Test that treemap_v2 uses columns field when groupby is missing."""
        form_data = {
            "metric": {"label": "Revenue"},
            "columns": ["region", "product"],
            "viz_type": "treemap_v2",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert "region" in groupby
        assert "product" in groupby


class TestGaugeChartFallback:
    """Tests for gauge_chart fallback query construction."""

    def test_gauge_chart_uses_singular_metric(self):
        """Test that gauge_chart uses 'metric' (singular)."""
        form_data = {
            "metric": {"label": "Completion %"},
            "viz_type": "gauge_chart",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Completion %"

    def test_gauge_chart_with_groupby(self):
        """Test that gauge_chart respects groupby if present."""
        form_data = {
            "metric": {"label": "Completion %"},
            "groupby": ["department"],
            "viz_type": "gauge_chart",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert groupby == ["department"]


class TestBubbleChartFallback:
    """Tests for bubble chart fallback query construction."""

    def test_bubble_extracts_x_y_size_as_metrics(self):
        """Test that bubble charts extract x, y, size as separate metrics."""
        form_data = {
            "x": {"label": "GDP"},
            "y": {"label": "Life Expectancy"},
            "size": {"label": "Population"},
            "entity": "country",
            "viz_type": "bubble",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 3
        assert metrics[0]["label"] == "GDP"
        assert metrics[1]["label"] == "Life Expectancy"
        assert metrics[2]["label"] == "Population"

    def test_bubble_extracts_entity_as_groupby(self):
        """Test that bubble charts use entity as groupby."""
        form_data = {
            "x": {"label": "GDP"},
            "y": {"label": "Life Expectancy"},
            "size": {"label": "Population"},
            "entity": "country",
            "viz_type": "bubble",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert "country" in groupby

    def test_bubble_extracts_series(self):
        """Test that bubble charts include series in groupby."""
        form_data = {
            "x": {"label": "GDP"},
            "y": {"label": "Life Expectancy"},
            "size": {"label": "Population"},
            "entity": "country",
            "series": "continent",
            "viz_type": "bubble",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert "country" in groupby
        assert "continent" in groupby

    def test_bubble_partial_metrics(self):
        """Test bubble chart with only some metric fields set."""
        form_data = {
            "x": {"label": "GDP"},
            "y": None,
            "size": {"label": "Population"},
            "entity": "country",
            "viz_type": "bubble",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 2
        labels = [m["label"] for m in metrics]
        assert "GDP" in labels
        assert "Population" in labels


class TestFallbackMetricExtraction:
    """Tests for the fallback singular metric extraction."""

    def test_standard_chart_falls_back_to_singular_metric(self):
        """Test that standard charts try singular metric if plural is empty."""
        form_data = {
            "metric": {"label": "Fallback Metric"},
            "metrics": [],
            "groupby": ["region"],
            "viz_type": "bar",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Fallback Metric"

    def test_standard_chart_no_metrics_at_all(self):
        """Test standard chart with neither metrics nor metric."""
        form_data = {
            "groupby": ["region"],
            "viz_type": "bar",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 0
        assert groupby == ["region"]

    def test_standard_chart_uses_columns_as_groupby_fallback(self):
        """Test that standard charts use columns field when groupby is empty."""
        form_data = {
            "metrics": [{"label": "Count"}],
            "columns": ["col_a", "col_b"],
            "viz_type": "table",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert "col_a" in groupby
        assert "col_b" in groupby

    def test_entity_series_fallback_for_unknown_chart(self):
        """Test that entity/series are used as groupby fallback."""
        form_data = {
            "metric": {"label": "Some Metric"},
            "entity": "name_col",
            "series": "type_col",
            "viz_type": "some_unknown_type",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert len(metrics) == 1
        assert "name_col" in groupby
        assert "type_col" in groupby


class TestSafetyNetEmptyQuery:
    """Tests for the safety net when no metrics/columns can be extracted."""

    def test_completely_empty_form_data_yields_empty(self):
        """Test that form_data with nothing extractable returns empty."""
        form_data = {
            "viz_type": "mystery_chart",
        }

        metrics, groupby = _extract_metrics_and_groupby(form_data)

        assert metrics == []
        assert groupby == []


class TestXAxisInQueryContext:
    """Tests for x_axis inclusion in fallback query context columns."""

    def test_x_axis_string_included_in_columns(self):
        """Test that x_axis (string format) is included alongside groupby columns."""
        form_data = {
            "x_axis": "territory",
            "groupby": ["year"],
            "metrics": [{"label": "SUM(sales)"}],
            "viz_type": "echarts_timeseries_bar",
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["territory", "year"]

    def test_x_axis_dict_included_in_columns(self):
        """Test that x_axis (dict format with column_name) is included."""
        form_data = {
            "x_axis": {"column_name": "territory"},
            "groupby": ["year"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)
        elif x_axis_config and isinstance(x_axis_config, dict):
            col_name = x_axis_config.get("column_name")
            if col_name and col_name not in columns:
                columns.insert(0, col_name)

        assert columns == ["territory", "year"]

    def test_no_x_axis_uses_groupby_only(self):
        """Test that without x_axis, only groupby columns are used."""
        form_data = {
            "groupby": ["region", "category"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["region", "category"]

    def test_x_axis_not_duplicated_if_in_groupby(self):
        """Test that x_axis is not duplicated if already in groupby list."""
        form_data = {
            "x_axis": "territory",
            "groupby": ["territory", "year"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["territory", "year"]

    def test_x_axis_without_groupby(self):
        """Test that x_axis works when there's no groupby."""
        form_data = {
            "x_axis": "date",
            "metrics": [{"label": "SUM(sales)"}],
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["date"]

    def test_empty_groupby_with_x_axis(self):
        """Test x_axis with explicitly empty groupby."""
        form_data = {
            "x_axis": "platform",
            "groupby": [],
            "metrics": [{"label": "SUM(global_sales)"}],
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["platform"]


class TestGetChartDataRequestSchema:
    """Test the GetChartDataRequest schema validation."""

    def test_default_request(self):
        """Test creating request with all defaults."""
        request = GetChartDataRequest(identifier=1)

        assert request.identifier == 1
        assert request.limit is None  # Uses chart's configured limit by default
        assert request.format == "json"
        assert request.use_cache is True
        assert request.force_refresh is False
        assert request.cache_timeout is None

    def test_request_with_uuid_identifier(self):
        """Test creating request with UUID identifier."""
        uuid = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
        request = GetChartDataRequest(identifier=uuid)

        assert request.identifier == uuid

    def test_request_with_custom_limit(self):
        """Test creating request with custom limit."""
        request = GetChartDataRequest(identifier=1, limit=500)

        assert request.limit == 500

    def test_request_with_csv_format(self):
        """Test creating request with CSV format."""
        request = GetChartDataRequest(identifier=1, format="csv")

        assert request.format == "csv"

    def test_request_with_excel_format(self):
        """Test creating request with Excel format."""
        request = GetChartDataRequest(identifier=1, format="excel")

        assert request.format == "excel"

    def test_request_with_cache_control(self):
        """Test creating request with cache control options."""
        request = GetChartDataRequest(
            identifier=1,
            use_cache=False,
            force_refresh=True,
            cache_timeout=3600,
        )

        assert request.use_cache is False
        assert request.force_refresh is True
        assert request.cache_timeout == 3600

    def test_invalid_format(self):
        """Test that invalid format raises validation error."""
        with pytest.raises(
            ValueError, match="Input should be 'json', 'csv' or 'excel'"
        ):
            GetChartDataRequest(identifier=1, format="invalid")

    def test_model_dump_serialization(self):
        """Test that the request serializes correctly for JSON."""
        request = GetChartDataRequest(
            identifier=123,
            limit=50,
            format="json",
        )

        data = request.model_dump()

        assert isinstance(data, dict)
        assert data["identifier"] == 123
        assert data["limit"] == 50
        assert data["format"] == "json"


class TestChartDataCommandValidation:
    """Tests that ChartDataCommand.validate() is called before run().

    These tests verify the security fix (CWE-862) that adds command.validate()
    before command.run() in MCP chart data tools. The validate() call enforces
    row-level security, guest user guards, and schema-level permissions.
    """

    def test_preview_utils_calls_validate_before_run(self):
        """Test that generate_preview_from_form_data calls validate() before run()."""
        from unittest.mock import MagicMock, patch

        call_order: list[str] = []
        mock_query_result = {"queries": [{"data": [{"col1": "a", "col2": 1}]}]}

        mock_command = MagicMock()
        mock_command.validate.side_effect = lambda: call_order.append("validate")
        mock_command.run.side_effect = lambda: (
            call_order.append("run"),
            mock_query_result,
        )[1]

        mock_dataset = MagicMock()
        mock_dataset.id = 10

        # ChartDataCommand is module-level import in preview_utils;
        # db and QueryContextFactory are local imports inside the function.
        with (
            patch("superset.extensions.db") as mock_db,
            patch(
                "superset.mcp_service.chart.preview_utils.ChartDataCommand",
                return_value=mock_command,
            ),
            patch(
                "superset.common.query_context_factory.QueryContextFactory"
            ) as mock_factory,
        ):
            mock_db.session.query.return_value.get.return_value = mock_dataset
            mock_factory.return_value.create.return_value = MagicMock()

            from superset.mcp_service.chart.preview_utils import (
                generate_preview_from_form_data,
            )

            generate_preview_from_form_data(
                form_data={"metrics": [{"label": "count"}], "viz_type": "table"},
                dataset_id=10,
                preview_format="table",
            )

            mock_command.validate.assert_called_once()
            mock_command.run.assert_called_once()
            assert call_order == ["validate", "run"]

    def test_preview_utils_security_exception_from_validate(self):
        """Test that SupersetSecurityException from validate() is propagated."""
        from unittest.mock import MagicMock, patch

        from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
        from superset.exceptions import SupersetSecurityException
        from superset.mcp_service.chart.schemas import ChartError

        security_error = SupersetSecurityException(
            SupersetError(
                message="Access denied",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

        mock_command = MagicMock()
        mock_command.validate.side_effect = security_error

        mock_dataset = MagicMock()
        mock_dataset.id = 10

        with (
            patch("superset.extensions.db") as mock_db,
            patch(
                "superset.mcp_service.chart.preview_utils.ChartDataCommand",
                return_value=mock_command,
            ),
            patch(
                "superset.common.query_context_factory.QueryContextFactory"
            ) as mock_factory,
        ):
            mock_db.session.query.return_value.get.return_value = mock_dataset
            mock_factory.return_value.create.return_value = MagicMock()

            from superset.mcp_service.chart.preview_utils import (
                generate_preview_from_form_data,
            )

            result = generate_preview_from_form_data(
                form_data={"metrics": [{"label": "count"}], "viz_type": "table"},
                dataset_id=10,
                preview_format="table",
            )

            # SupersetSecurityException is caught by the broad except and
            # returned as a ChartError
            assert isinstance(result, ChartError)
            assert "Access denied" in result.error
            mock_command.run.assert_not_called()

    def test_compile_chart_calls_validate_before_run(self):
        """Test that _compile_chart calls validate() before run()."""
        from unittest.mock import MagicMock, patch

        call_order: list[str] = []
        mock_query_result = {"queries": [{"data": [{"col1": 1}]}]}

        mock_command = MagicMock()
        mock_command.validate.side_effect = lambda: call_order.append("validate")
        mock_command.run.side_effect = lambda: (
            call_order.append("run"),
            mock_query_result,
        )[1]

        # Both ChartDataCommand and QueryContextFactory are local imports
        # inside _compile_chart, so patch at source.
        with (
            patch(
                "superset.commands.chart.data.get_data_command.ChartDataCommand",
                return_value=mock_command,
            ),
            patch(
                "superset.common.query_context_factory.QueryContextFactory"
            ) as mock_factory,
        ):
            mock_factory.return_value.create.return_value = MagicMock()

            from superset.mcp_service.chart.tool.generate_chart import _compile_chart

            result = _compile_chart(
                form_data={"metrics": [{"label": "count"}], "viz_type": "table"},
                dataset_id=10,
            )

            assert result.success is True
            mock_command.validate.assert_called_once()
            mock_command.run.assert_called_once()
            assert call_order == ["validate", "run"]

    def test_compile_chart_security_exception_from_validate(self):
        """Test that _compile_chart propagates security exception from validate()."""
        from unittest.mock import MagicMock, patch

        from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
        from superset.exceptions import SupersetSecurityException

        security_error = SupersetSecurityException(
            SupersetError(
                message="Row-level security violation",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

        mock_command = MagicMock()
        mock_command.validate.side_effect = security_error

        with (
            patch(
                "superset.commands.chart.data.get_data_command.ChartDataCommand",
                return_value=mock_command,
            ),
            patch(
                "superset.common.query_context_factory.QueryContextFactory"
            ) as mock_factory,
        ):
            mock_factory.return_value.create.return_value = MagicMock()

            from superset.mcp_service.chart.tool.generate_chart import _compile_chart

            # SupersetSecurityException is not caught by _compile_chart's
            # specific except blocks, so it propagates to the caller
            # (generate_chart's broad except handler).
            with pytest.raises(SupersetSecurityException):
                _compile_chart(
                    form_data={"metrics": [{"label": "count"}], "viz_type": "table"},
                    dataset_id=10,
                )

            mock_command.run.assert_not_called()


@pytest.fixture
def mcp_server():
    from superset.mcp_service.app import mcp

    return mcp


@pytest.fixture
def mock_auth():
    """Mock MCP auth so Client.call_tool() doesn't need a real admin user."""
    import importlib
    from contextlib import contextmanager
    from unittest.mock import Mock, patch

    _gcd_module = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_data"
    )

    @contextmanager
    def _noop_log_context(*_args: Any, **_kwargs: Any) -> Any:
        yield lambda **_kw: None

    # Neutralize event_logger.log_context: the default DBEventLogger would
    # otherwise insert a log row referencing our mock user_id and fail a
    # FK constraint against the real users table. Patch via the module
    # object directly — the `tool` package's __init__.py re-exports the
    # get_chart_data function under the same name, which shadows the
    # submodule binding in the package namespace, so a dotted-string patch
    # target resolves to the function and mock.patch cannot find
    # event_logger on it.
    mock_event_logger = Mock()
    mock_event_logger.log_context.side_effect = _noop_log_context
    with (
        patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user,
        patch.object(_gcd_module, "event_logger", mock_event_logger),
    ):
        user = Mock()
        user.id = 1
        user.username = "admin"
        mock_get_user.return_value = user
        yield mock_get_user


def _extract_metrics_load_path(load_opt: Any) -> list[str]:
    """Walk a SQLAlchemy Load option and return the attr chain.

    e.g. subqueryload(Slice.table).subqueryload(SqlaTable.metrics)
    -> ["table", "metrics"]
    """
    path = getattr(load_opt, "path", ())
    return [elem.key for elem in path if hasattr(elem, "key")]


class TestChartLookupEagerLoading:
    """Tests that get_chart_data eager-loads dataset.metrics on chart lookup.

    Regression tests for the Excel export DetachedInstanceError on
    dataset.metrics. The chart's dataset metrics relationship must be
    eager-loaded at fetch time so it remains accessible during Excel export
    after the request-scoped session is detached.
    """

    @pytest.mark.asyncio
    async def test_numeric_id_lookup_passes_metrics_eager_load(
        self, mcp_server, mock_auth
    ):
        """Integer identifier lookup must eager-load Slice.table.metrics."""
        from unittest.mock import patch

        from fastmcp import Client

        with patch(
            "superset.daos.chart.ChartDAO.find_by_id", return_value=None
        ) as mock_find:
            async with Client(mcp_server) as client:
                await client.call_tool(
                    "get_chart_data",
                    {"request": {"identifier": 42, "format": "excel"}},
                )

            mock_find.assert_called_once()
            call = mock_find.call_args
            assert call.args == (42,)
            query_options = call.kwargs.get("query_options")
            assert query_options is not None, (
                "Chart lookup must pass query_options for eager-loading."
            )
            assert len(query_options) == 1
            load_path = _extract_metrics_load_path(query_options[0])
            assert load_path == ["table", "metrics"], (
                f"Expected subqueryload chain 'table' -> 'metrics', got {load_path}"
            )

    @pytest.mark.asyncio
    async def test_uuid_lookup_passes_metrics_eager_load(self, mcp_server, mock_auth):
        """UUID identifier lookup must also eager-load Slice.table.metrics."""
        from unittest.mock import patch

        from fastmcp import Client

        uuid = "a1b2c3d4-5678-90ab-cdef-1234567890ab"

        with patch(
            "superset.daos.chart.ChartDAO.find_by_id", return_value=None
        ) as mock_find:
            async with Client(mcp_server) as client:
                await client.call_tool(
                    "get_chart_data",
                    {"request": {"identifier": uuid, "format": "excel"}},
                )

            mock_find.assert_called_once()
            call = mock_find.call_args
            assert call.args == (uuid,)
            assert call.kwargs.get("id_column") == "uuid"
            query_options = call.kwargs.get("query_options")
            assert query_options is not None, (
                "UUID chart lookup must pass query_options for eager-loading."
            )
            load_path = _extract_metrics_load_path(query_options[0])
            assert load_path == ["table", "metrics"], (
                f"Expected subqueryload chain 'table' -> 'metrics', got {load_path}"
            )

    @pytest.mark.asyncio
    async def test_json_format_also_eager_loads_metrics(self, mcp_server, mock_auth):
        """Eager-load is applied for every format, not just Excel.

        Applying unconditionally keeps the fix robust if additional code paths
        start touching dataset.metrics, and avoids branching behavior that
        would be easy to regress on.
        """
        from unittest.mock import patch

        from fastmcp import Client

        with patch(
            "superset.daos.chart.ChartDAO.find_by_id", return_value=None
        ) as mock_find:
            async with Client(mcp_server) as client:
                await client.call_tool(
                    "get_chart_data",
                    {"request": {"identifier": 7, "format": "json"}},
                )

            call = mock_find.call_args
            query_options = call.kwargs.get("query_options")
            assert query_options is not None
            assert _extract_metrics_load_path(query_options[0]) == ["table", "metrics"]
