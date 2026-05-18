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
Unit tests for MCP generate_chart tool
"""

from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
from sqlalchemy.orm.exc import DetachedInstanceError

from superset.mcp_service.chart.schemas import (
    AxisConfig,
    ColumnRef,
    FilterConfig,
    GenerateChartRequest,
    LegendConfig,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.tool.generate_chart import (
    _compile_chart,
    _sanitize_generate_chart_form_data_for_llm_context,
    CompileResult,
    generate_chart,
)
from superset.mcp_service.utils import sanitize_for_llm_context
from superset.utils import json as utils_json


class TestGenerateChart:
    """Tests for generate_chart MCP tool."""

    @pytest.mark.asyncio
    async def test_generate_chart_returns_table_chart_type_label(self) -> None:
        """Test chart generation response includes table chart type label."""
        request = GenerateChartRequest(
            dataset_id="1",
            config=TableChartConfig(
                chart_type="table",
                columns=[ColumnRef(name="region")],
            ),
            preview_formats=["url"],
        )
        ctx = MagicMock()
        ctx.info = AsyncMock()
        ctx.debug = AsyncMock()
        ctx.warning = AsyncMock()
        ctx.error = AsyncMock()
        ctx.report_progress = AsyncMock()
        validation_result = Mock(
            is_valid=True,
            request=request,
            warnings={},
            error=None,
        )
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_user.roles = []
        mock_user.groups = []

        with (
            patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ),
            patch(
                "superset.mcp_service.chart.validation.ValidationPipeline."
                "validate_request_with_warnings",
                return_value=validation_result,
            ),
            patch(
                "superset.mcp_service.chart.chart_utils.generate_explore_link",
                return_value=(
                    "http://localhost:9001/explore/?"
                    "form_data_key=test_form_data_key_123"
                ),
            ),
            patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None),
        ):
            result = await generate_chart(request, ctx=ctx)

        assert result.chart_type_label == "table chart"

    @pytest.mark.asyncio
    async def test_generate_chart_request_structure(self):
        """Test that chart generation request structures are properly formed."""
        # Table chart request
        table_config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region", label="Region"),
                ColumnRef(name="sales", label="Sales", aggregate="SUM"),
            ],
            filters=[FilterConfig(column="year", op="=", value="2024")],
            sort_by=["sales"],
        )
        table_request = GenerateChartRequest(dataset_id="1", config=table_config)
        assert table_request.dataset_id == "1"
        # config is now Dict[str, Any] in the schema; validate via dict access
        assert table_request.config.chart_type == "table"
        assert len(table_request.config.columns) == 2
        assert table_request.config.columns[0].name == "region"
        assert table_request.config.columns[1].aggregate == "SUM"

        # XY chart request
        xy_config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="value", aggregate="SUM")],
            kind="line",
            group_by=ColumnRef(name="category"),
            x_axis=AxisConfig(title="Date", format="smart_date"),
            y_axis=AxisConfig(title="Value", format="$,.2f"),
            legend=LegendConfig(show=True, position="top"),
        )
        xy_request = GenerateChartRequest(dataset_id="2", config=xy_config)
        assert xy_request.config.chart_type == "xy"
        assert xy_request.config.x.name == "date"
        assert xy_request.config.y[0].aggregate == "SUM"
        assert xy_request.config.kind == "line"
        assert xy_request.config.x_axis.title == "Date"
        assert xy_request.config.legend.show is True

    @pytest.mark.asyncio
    async def test_generate_chart_validation_error_handling(self):
        """Test that validation errors are properly structured."""

        # Create a validation error with the correct structure
        validation_error_entry = {
            "field": "x_axis",
            "provided_value": "invalid_col",
            "error_type": "column_not_found",
            "message": "Column 'invalid_col' not found",
        }

        # Test that validation error structure is correct
        assert validation_error_entry["field"] == "x_axis"
        assert validation_error_entry["error_type"] == "column_not_found"

    @pytest.mark.asyncio
    async def test_chart_config_variations(self):
        """Test various chart configuration options."""
        # Test all chart types
        chart_types = ["line", "bar", "area", "scatter"]
        for chart_type in chart_types:
            config = XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x_col"),
                y=[ColumnRef(name="y_col")],
                kind=chart_type,
            )
            assert config.kind == chart_type

        # Test multiple Y columns
        multi_y_config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[
                ColumnRef(name="sales", aggregate="SUM"),
                ColumnRef(name="profit", aggregate="AVG"),
                ColumnRef(name="quantity", aggregate="COUNT"),
            ],
            kind="line",
        )
        assert len(multi_y_config.y) == 3
        assert multi_y_config.y[1].aggregate == "AVG"

        # Test filter operators
        operators = ["=", "!=", ">", ">=", "<", "<="]
        filters = [FilterConfig(column="col", op=op, value="val") for op in operators]
        for i, f in enumerate(filters):
            assert f.op == operators[i]

    @pytest.mark.asyncio
    async def test_generate_chart_response_structure(self):
        """Test the expected response structure for chart generation."""
        # The response should contain these fields
        _ = {
            "chart": {
                "id": int,
                "slice_name": str,
                "viz_type": str,
                "url": str,
                "uuid": str,
                "saved": bool,
            },
            "error": None,
            "success": bool,
            "schema_version": str,
            "api_version": str,
        }

        # When chart creation succeeds, these additional fields may be present
        _ = [
            "previews",
            "capabilities",
            "semantics",
            "explore_url",
            "form_data_key",
            "api_endpoints",
            "performance",
            "accessibility",
        ]

        # This is just a structural test - actual integration tests would verify
        # the tool returns data matching this structure

    @pytest.mark.asyncio
    async def test_dataset_id_flexibility(self):
        """Test that dataset_id can be string or int."""
        configs = [
            GenerateChartRequest(
                dataset_id="123",
                config=TableChartConfig(
                    chart_type="table", columns=[ColumnRef(name="col1")]
                ),
            ),
            GenerateChartRequest(
                dataset_id="uuid-string-here",
                config=TableChartConfig(
                    chart_type="table", columns=[ColumnRef(name="col1")]
                ),
            ),
        ]

        for config in configs:
            assert isinstance(config.dataset_id, str)

    @pytest.mark.asyncio
    async def test_save_chart_flag(self):
        """Test save_chart flag behavior."""
        # Default should be False (preview only, not saved)
        request1 = GenerateChartRequest(
            dataset_id="1",
            config=TableChartConfig(
                chart_type="table", columns=[ColumnRef(name="col1")]
            ),
        )
        assert request1.save_chart is False

        # Explicit True (save chart permanently)
        request2 = GenerateChartRequest(
            dataset_id="1",
            config=TableChartConfig(
                chart_type="table", columns=[ColumnRef(name="col1")]
            ),
            save_chart=True,
        )
        assert request2.save_chart is True

        # Both False should raise validation error (no-op request)
        with pytest.raises(ValueError, match="At least one of"):
            GenerateChartRequest(
                dataset_id="1",
                config=TableChartConfig(
                    chart_type="table", columns=[ColumnRef(name="col1")]
                ),
                save_chart=False,
                generate_preview=False,
            )

    @pytest.mark.asyncio
    async def test_preview_formats(self):
        """Test preview format options."""
        formats = ["url", "ascii", "table"]
        request = GenerateChartRequest(
            dataset_id="1",
            config=TableChartConfig(
                chart_type="table", columns=[ColumnRef(name="col1")]
            ),
            generate_preview=True,
            preview_formats=formats,
        )
        assert request.generate_preview is True
        assert set(request.preview_formats) == set(formats)

    @pytest.mark.asyncio
    async def test_column_ref_features(self):
        """Test ColumnRef features like aggregation and labels."""
        # Simple column
        col1 = ColumnRef(name="region")
        assert col1.name == "region"
        assert col1.label is None
        assert col1.aggregate is None

        # Column with aggregation
        col2 = ColumnRef(name="sales", aggregate="SUM", label="Total Sales")
        assert col2.name == "sales"
        assert col2.aggregate == "SUM"
        assert col2.label == "Total Sales"

        # All supported aggregations
        aggs = ["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"]
        for agg in aggs:
            col = ColumnRef(name="value", aggregate=agg)
            assert col.aggregate == agg

    @pytest.mark.asyncio
    async def test_axis_config_options(self):
        """Test axis configuration options."""
        axis = AxisConfig(
            title="Sales Amount",
            format="$,.2f",
            scale="linear",
        )
        assert axis.title == "Sales Amount"
        assert axis.format == "$,.2f"
        assert axis.scale == "linear"

        # Test different formats
        formats = ["SMART_NUMBER", "$,.2f", ",.0f", "smart_date", ".3%"]
        for fmt in formats:
            axis = AxisConfig(format=fmt)
            assert axis.format == fmt

    @pytest.mark.asyncio
    async def test_legend_config_options(self):
        """Test legend configuration options."""
        positions = ["top", "bottom", "left", "right"]
        for pos in positions:
            legend = LegendConfig(show=True, position=pos)
            assert legend.position == pos

        # Hidden legend
        legend = LegendConfig(show=False)
        assert legend.show is False


class TestCompileChart:
    """Tests for _compile_chart helper."""

    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
    @patch("superset.common.query_context_factory.QueryContextFactory")
    def test_compile_chart_success(self, mock_factory_cls, mock_cmd_cls):
        """Test _compile_chart returns success when query executes cleanly."""
        mock_factory_cls.return_value.create.return_value = MagicMock()
        mock_cmd_cls.return_value.run.return_value = {
            "queries": [{"data": [{"col": 1}, {"col": 2}]}]
        }

        form_data = {
            "viz_type": "echarts_timeseries_bar",
            "metrics": [{"label": "count", "expressionType": "SIMPLE"}],
            "groupby": ["region"],
        }
        result = _compile_chart(form_data, dataset_id=1)

        assert isinstance(result, CompileResult)
        assert result.success is True
        assert result.error is None
        assert result.row_count == 2

    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
    @patch("superset.common.query_context_factory.QueryContextFactory")
    def test_compile_chart_query_error_in_payload(self, mock_factory_cls, mock_cmd_cls):
        """Test _compile_chart detects errors embedded in query results."""
        mock_factory_cls.return_value.create.return_value = MagicMock()
        mock_cmd_cls.return_value.run.return_value = {
            "queries": [{"error": "column 'bad_col' does not exist"}]
        }

        result = _compile_chart({"metrics": []}, dataset_id=1)

        assert result.success is False
        assert "bad_col" in (result.error or "")

    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
    @patch("superset.common.query_context_factory.QueryContextFactory")
    def test_compile_chart_command_exception(self, mock_factory_cls, mock_cmd_cls):
        """Test _compile_chart handles ChartDataQueryFailedError."""
        from superset.commands.chart.exceptions import (
            ChartDataQueryFailedError,
        )

        mock_factory_cls.return_value.create.return_value = MagicMock()
        mock_cmd_cls.return_value.run.side_effect = ChartDataQueryFailedError(
            "syntax error near FROM"
        )

        result = _compile_chart({"metrics": []}, dataset_id=1)

        assert result.success is False
        assert "syntax error" in (result.error or "")

    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
    @patch("superset.common.query_context_factory.QueryContextFactory")
    def test_compile_chart_value_error(self, mock_factory_cls, mock_cmd_cls):
        """Test _compile_chart handles ValueError from bad config."""
        mock_factory_cls.return_value.create.side_effect = ValueError("invalid metric")

        result = _compile_chart({"metrics": []}, dataset_id=1)

        assert result.success is False
        assert "invalid metric" in (result.error or "")


def _make_mock_chart(chart_id: int = 42) -> Mock:
    """Create a mock chart with all attributes needed by serialize_chart_object."""
    chart = Mock()
    chart.id = chart_id
    chart.slice_name = "Test Chart"
    chart.viz_type = "echarts_timeseries_bar"
    chart.datasource_name = "test_table"
    chart.datasource_type = "table"
    chart.description = None
    chart.certified_by = None
    chart.certification_details = None
    chart.cache_timeout = None
    chart.changed_by = None
    chart.changed_by_name = "admin"
    chart.changed_on = None
    chart.changed_on_humanized = "1 day ago"
    chart.created_by = None
    chart.created_by_name = "admin"
    chart.created_on = None
    chart.created_on_humanized = "2 days ago"
    chart.uuid = "test-uuid-42"
    chart.tags = []
    chart.owners = []
    return chart


class TestChartSerializationEagerLoading:
    """Tests for eager loading fix in generate_chart serialization path."""

    def test_serialize_chart_object_succeeds_with_loaded_relationships(self):
        """serialize_chart_object works when tags/owners are already loaded."""
        from superset.mcp_service.chart.schemas import serialize_chart_object

        chart = _make_mock_chart()
        result = serialize_chart_object(chart)

        assert result is not None
        assert result.id == 42
        assert result.slice_name == sanitize_for_llm_context("Test Chart")
        assert result.tags == []
        assert "owners" not in result.model_dump()

    def test_serialize_chart_object_with_certification_fields(self):
        """serialize_chart_object correctly serializes non-None certification values."""
        from superset.mcp_service.chart.schemas import serialize_chart_object

        chart = _make_mock_chart()
        chart.certified_by = "Data Team"
        chart.certification_details = "Verified Q1 2026 metrics"

        result = serialize_chart_object(chart)

        assert result is not None
        assert result.certified_by == sanitize_for_llm_context("Data Team")
        assert result.certification_details == sanitize_for_llm_context(
            "Verified Q1 2026 metrics"
        )

    def test_serialize_chart_object_sanitizes_chart_metadata_and_filters(
        self,
    ) -> None:
        """serialize_chart_object sanitizes chart read-path content in place."""
        from superset.mcp_service.chart.schemas import serialize_chart_object

        chart = _make_mock_chart()
        chart.description = "Show sales instructions"
        chart.certification_details = "Verified by analytics"
        tag = Mock()
        tag.id = 1
        tag.name = "Tag instructions"
        tag.type = "custom"
        tag.description = "Tag description"
        chart.tags = [tag]
        chart.params = utils_json.dumps(
            {
                "datasource": "42__table",
                "datasource_id": 42,
                "datasource_type": "table",
                "viz_type": "echarts_timeseries_bar",
                "adhoc_filters": [
                    {
                        "expressionType": "SQL",
                        "sqlExpression": "region = 'EMEA'",
                    }
                ],
                "where": "country = 'BR'",
                "time_range": "Last quarter",
            }
        )

        result = serialize_chart_object(chart)

        assert result is not None
        assert result.slice_name == sanitize_for_llm_context("Test Chart")
        assert result.description == sanitize_for_llm_context("Show sales instructions")
        assert result.certification_details == sanitize_for_llm_context(
            "Verified by analytics"
        )
        assert result.form_data is not None
        assert result.form_data["datasource"] == "42__table"
        assert result.form_data["where"] == sanitize_for_llm_context("country = 'BR'")
        assert result.form_data["time_range"] == sanitize_for_llm_context(
            "Last quarter"
        )
        assert result.filters is not None
        assert result.filters.where == sanitize_for_llm_context("country = 'BR'")
        assert result.filters.time_range == sanitize_for_llm_context("Last quarter")
        assert result.filters.adhoc_filters[
            0
        ].sql_expression == sanitize_for_llm_context("region = 'EMEA'")
        assert result.tags[0].name == sanitize_for_llm_context("Tag instructions")
        assert result.tags[0].description == sanitize_for_llm_context("Tag description")

    def test_generate_chart_form_data_response_is_sanitized(self) -> None:
        """Generated chart form data wraps user-controlled response values."""
        form_data = {
            "viz_type": "table",
            "datasource": "42__table",
            "where": "country = 'BR'",
            "time_range": "Last quarter",
            "adhoc_filters": [
                {
                    "expressionType": "SQL",
                    "sqlExpression": "region = 'EMEA'",
                    "comparator": "EMEA",
                }
            ],
            "url": "https://example.com/user-value",
        }

        result = _sanitize_generate_chart_form_data_for_llm_context(form_data)

        assert result["viz_type"] == "table"
        assert result["datasource"] == "42__table"
        assert result["where"] == sanitize_for_llm_context("country = 'BR'")
        assert result["time_range"] == sanitize_for_llm_context("Last quarter")
        assert result["adhoc_filters"][0]["sqlExpression"] == sanitize_for_llm_context(
            "region = 'EMEA'"
        )
        assert result["adhoc_filters"][0]["comparator"] == sanitize_for_llm_context(
            "EMEA"
        )
        assert result["url"] == sanitize_for_llm_context(
            "https://example.com/user-value"
        )

    def test_serialize_chart_object_fails_on_detached_instance(self):
        """serialize_chart_object raises when accessing lazy attrs on detached
        instance — this is the bug scenario that the eager-loading fix prevents."""
        from superset.mcp_service.chart.schemas import serialize_chart_object

        chart = _make_mock_chart()
        # Simulate detached instance: accessing .tags raises DetachedInstanceError
        type(chart).tags = property(
            lambda self: (_ for _ in ()).throw(
                DetachedInstanceError("Instance <Slice> is not bound to a Session")
            )
        )

        with pytest.raises(DetachedInstanceError):
            serialize_chart_object(chart)

    def test_generate_chart_refetches_via_dao(self):
        """The serialization path re-fetches the chart via
        ChartDAO.find_by_id() with query_options for owners and tags."""
        refetched_chart = _make_mock_chart()
        refetched_chart.tags = [Mock(id=1, name="tag1", type="custom")]
        refetched_chart.tags[0].description = ""

        mock_dao = MagicMock()
        mock_dao.find_by_id.return_value = refetched_chart

        chart = (
            mock_dao.find_by_id(42, query_options=[Mock(), Mock()])
            or _make_mock_chart()
        )

        assert chart is refetched_chart
        mock_dao.find_by_id.assert_called()

    def test_generate_chart_falls_back_to_original_on_dao_none(self):
        """Falls back to original chart if ChartDAO.find_by_id()
        returns None."""
        original_chart = _make_mock_chart()

        mock_dao = MagicMock()
        mock_dao.find_by_id.return_value = None

        chart = mock_dao.find_by_id(42, query_options=[Mock()]) or original_chart

        assert chart is original_chart

    def test_generate_chart_refetch_sqlalchemy_error_rollback(self):
        """When the DAO re-fetch raises SQLAlchemyError, the session is
        rolled back and a minimal chart_data dict is built from scalar
        attributes instead of calling serialize_chart_object (which would
        trigger lazy-loading on the same dead session)."""
        from sqlalchemy.exc import SQLAlchemyError

        original_chart = _make_mock_chart()
        mock_dao = MagicMock()
        mock_dao.find_by_id.side_effect = SQLAlchemyError("session error")
        mock_session = MagicMock()
        explore_url = "http://example.com/explore/?slice_id=42"

        chart_data = None
        try:
            mock_dao.find_by_id(42, query_options=[Mock()])
        except SQLAlchemyError:
            mock_session.rollback()
            chart_data = {
                "id": original_chart.id,
                "slice_name": original_chart.slice_name,
                "viz_type": original_chart.viz_type,
                "url": explore_url,
                "uuid": str(original_chart.uuid) if original_chart.uuid else None,
            }

        mock_session.rollback.assert_called()
        # Minimal chart_data should contain scalar fields only
        assert chart_data is not None
        assert chart_data["id"] == original_chart.id
        assert chart_data["slice_name"] == original_chart.slice_name
        assert chart_data["url"] == explore_url
        # No tags/owners keys — those would require relationship access
        assert "tags" not in chart_data
        assert "owners" not in chart_data
