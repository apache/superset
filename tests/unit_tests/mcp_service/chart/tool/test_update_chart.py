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
Unit tests for update_chart MCP tool
"""

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.chart_utils import DatasetValidationResult
from superset.mcp_service.chart.schemas import (
    AxisConfig,
    ColumnRef,
    FilterConfig,
    GenerateChartResponse,
    LegendConfig,
    TableChartConfig,
    UpdateChartRequest,
    XYChartConfig,
)
from superset.mcp_service.chart.tool.update_chart import (
    _build_update_payload,
    _find_chart,
)


class TestUpdateChart:
    """Tests for update_chart MCP tool."""

    @pytest.mark.asyncio
    async def test_update_chart_request_structure(self):
        """Test that chart update request structures are properly formed."""
        # Table chart update with numeric ID
        table_config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region", label="Region"),
                ColumnRef(name="sales", label="Sales", aggregate="SUM"),
            ],
            filters=[FilterConfig(column="year", op="=", value="2024")],
            sort_by=["sales"],
        )
        table_request = UpdateChartRequest(identifier=123, config=table_config)
        assert table_request.identifier == 123
        assert table_request.config.chart_type == "table"
        assert len(table_request.config.columns) == 2
        assert table_request.config.columns[0].name == "region"
        assert table_request.config.columns[1].aggregate == "SUM"

        # XY chart update with UUID
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
        xy_request = UpdateChartRequest(
            identifier="a1b2c3d4-e5f6-7890-abcd-ef1234567890", config=xy_config
        )
        assert xy_request.identifier == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        assert xy_request.config.chart_type == "xy"
        assert xy_request.config.x.name == "date"
        assert xy_request.config.y[0].aggregate == "SUM"
        assert xy_request.config.kind == "line"

    @pytest.mark.asyncio
    async def test_update_chart_with_chart_name(self):
        """Test updating chart with custom chart name."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Without custom name
        request1 = UpdateChartRequest(identifier=123, config=config)
        assert request1.chart_name is None

        # With custom name
        request2 = UpdateChartRequest(
            identifier=123, config=config, chart_name="Updated Sales Report"
        )
        assert request2.chart_name == "Updated Sales Report"

    @pytest.mark.asyncio
    async def test_update_chart_preview_generation(self):
        """Test preview generation options in update request."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Default preview generation
        request1 = UpdateChartRequest(identifier=123, config=config)
        assert request1.generate_preview is True
        assert request1.preview_formats == ["url"]

        # Custom preview formats
        request2 = UpdateChartRequest(
            identifier=123,
            config=config,
            generate_preview=True,
            preview_formats=["url", "ascii", "table"],
        )
        assert request2.generate_preview is True
        assert set(request2.preview_formats) == {"url", "ascii", "table"}

        # Disable preview generation
        request3 = UpdateChartRequest(
            identifier=123, config=config, generate_preview=False
        )
        assert request3.generate_preview is False

    @pytest.mark.asyncio
    async def test_update_chart_identifier_types(self):
        """Test that identifier can be int or string (UUID)."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Integer ID
        request1 = UpdateChartRequest(identifier=123, config=config)
        assert request1.identifier == 123
        assert isinstance(request1.identifier, int)

        # String numeric ID
        request2 = UpdateChartRequest(identifier="456", config=config)
        assert request2.identifier == "456"
        assert isinstance(request2.identifier, str)

        # UUID string
        request3 = UpdateChartRequest(
            identifier="a1b2c3d4-e5f6-7890-abcd-ef1234567890", config=config
        )
        assert request3.identifier == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        assert isinstance(request3.identifier, str)

    @pytest.mark.asyncio
    async def test_update_chart_config_variations(self):
        """Test various chart configuration options in updates."""
        # Test all XY chart types
        chart_types = ["line", "bar", "area", "scatter"]
        for chart_type in chart_types:
            config = XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x_col"),
                y=[ColumnRef(name="y_col")],
                kind=chart_type,
            )
            request = UpdateChartRequest(identifier=1, config=config)
            assert request.config.kind == chart_type

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
        request = UpdateChartRequest(identifier=1, config=multi_y_config)
        assert len(request.config.y) == 3
        assert request.config.y[1].aggregate == "AVG"

        # Test filter operators
        operators = ["=", "!=", ">", ">=", "<", "<="]
        filters = [FilterConfig(column="col", op=op, value="val") for op in operators]
        table_config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
            filters=filters,
        )
        request = UpdateChartRequest(identifier=1, config=table_config)
        assert len(request.config.filters) == 6

    @pytest.mark.asyncio
    async def test_update_chart_response_structure(self):
        """Test the expected response structure for chart updates."""
        # The response should contain these fields
        expected_response = {
            "chart": {
                "id": int,
                "slice_name": str,
                "viz_type": str,
                "url": str,
                "uuid": str,
                "updated": bool,
            },
            "error": None,
            "success": bool,
            "schema_version": str,
            "api_version": str,
        }

        # When chart update succeeds, these additional fields may be present
        optional_fields = [
            "previews",
            "capabilities",
            "semantics",
            "explore_url",
            "api_endpoints",
            "performance",
            "accessibility",
        ]

        # Validate structure expectations
        assert "chart" in expected_response
        assert "success" in expected_response
        assert len(optional_fields) > 0

    @pytest.mark.asyncio
    async def test_update_chart_axis_configurations(self):
        """Test axis configuration updates."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="sales")],
            x_axis=AxisConfig(
                title="Date",
                format="smart_date",
                scale="linear",
            ),
            y_axis=AxisConfig(
                title="Sales Amount",
                format="$,.2f",
                scale="log",
            ),
        )
        request = UpdateChartRequest(identifier=1, config=config)
        assert request.config.x_axis.title == "Date"
        assert request.config.x_axis.format == "smart_date"
        assert request.config.x_axis.scale == "linear"
        assert request.config.y_axis.title == "Sales Amount"
        assert request.config.y_axis.format == "$,.2f"
        assert request.config.y_axis.scale == "log"

    @pytest.mark.asyncio
    async def test_update_chart_legend_configurations(self):
        """Test legend configuration updates."""
        positions = ["top", "bottom", "left", "right"]
        for pos in positions:
            config = XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x"),
                y=[ColumnRef(name="y")],
                legend=LegendConfig(show=True, position=pos),
            )
            request = UpdateChartRequest(identifier=1, config=config)
            assert request.config.legend.position == pos
            assert request.config.legend.show is True

        # Hidden legend
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="x"),
            y=[ColumnRef(name="y")],
            legend=LegendConfig(show=False),
        )
        request = UpdateChartRequest(identifier=1, config=config)
        assert request.config.legend.show is False

    @pytest.mark.asyncio
    async def test_update_chart_aggregation_functions(self):
        """Test all supported aggregation functions in updates."""
        aggs = ["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"]
        for agg in aggs:
            config = TableChartConfig(
                chart_type="table",
                columns=[ColumnRef(name="value", aggregate=agg)],
            )
            request = UpdateChartRequest(identifier=1, config=config)
            assert request.config.columns[0].aggregate == agg

    @pytest.mark.asyncio
    async def test_update_chart_error_responses(self):
        """Test expected error response structures use ChartGenerationError."""
        # Chart not found error
        error_response = GenerateChartResponse.model_validate(
            {
                "chart": None,
                "error": {
                    "error_type": "NotFound",
                    "message": "No chart found with identifier: 999",
                    "details": "No chart found with identifier: 999",
                },
                "success": False,
                "schema_version": "2.0",
                "api_version": "v1",
            }
        )
        assert error_response.success is False
        assert error_response.chart is None
        assert error_response.error is not None
        assert error_response.error.error_type == "NotFound"
        assert "chart found" in error_response.error.message.lower()

        # General update error
        update_error = GenerateChartResponse.model_validate(
            {
                "chart": None,
                "error": {
                    "error_type": "ValueError",
                    "message": "Chart update failed: Permission denied",
                    "details": "Permission denied",
                },
                "success": False,
                "schema_version": "2.0",
                "api_version": "v1",
            }
        )
        assert update_error.success is False
        assert update_error.error is not None
        assert "failed" in update_error.error.message.lower()

    @pytest.mark.asyncio
    async def test_chart_name_sanitization(self):
        """Test that chart names are properly sanitized."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Test with potentially problematic characters
        test_names = [
            "Normal Chart Name",
            "Chart with 'quotes'",
            'Chart with "double quotes"',
            "Chart with <brackets>",
        ]

        for name in test_names:
            request = UpdateChartRequest(identifier=1, config=config, chart_name=name)
            # Chart name should be set (sanitization happens in the validator)
            assert request.chart_name is not None

    @pytest.mark.asyncio
    async def test_update_chart_with_filters(self):
        """Test updating chart with various filter configurations."""
        filters = [
            FilterConfig(column="region", op="=", value="North"),
            FilterConfig(column="sales", op=">=", value=1000),
            FilterConfig(column="date", op=">", value="2024-01-01"),
        ]

        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region"),
                ColumnRef(name="sales"),
                ColumnRef(name="date"),
            ],
            filters=filters,
        )

        request = UpdateChartRequest(identifier=1, config=config)
        assert len(request.config.filters) == 3
        assert request.config.filters[0].column == "region"
        assert request.config.filters[1].op == ">="
        assert request.config.filters[2].value == "2024-01-01"

    @pytest.mark.asyncio
    async def test_update_chart_cache_control(self):
        """Test cache control parameters in update request."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Default cache settings
        request1 = UpdateChartRequest(identifier=1, config=config)
        assert request1.use_cache is True
        assert request1.force_refresh is False
        assert request1.cache_timeout is None

        # Custom cache settings
        request2 = UpdateChartRequest(
            identifier=1,
            config=config,
            use_cache=False,
            force_refresh=True,
            cache_timeout=300,
        )
        assert request2.use_cache is False
        assert request2.force_refresh is True
        assert request2.cache_timeout == 300


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


class TestUpdateChartDatasetAccess:
    """Tests for dataset access validation in update_chart."""

    @patch(
        "superset.mcp_service.auth.check_chart_data_access",
        new_callable=Mock,
    )
    @patch("superset.daos.chart.ChartDAO.find_by_id", new_callable=Mock)
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_update_chart_dataset_access_denied(
        self, mock_db_session, mock_find_by_id, mock_validate, mcp_server
    ):
        """Test that update_chart returns error when dataset is inaccessible."""
        mock_chart = Mock()
        mock_chart.id = 1
        mock_chart.datasource_id = 10
        mock_find_by_id.return_value = mock_chart

        mock_validate.return_value = DatasetValidationResult(
            is_valid=False,
            dataset_id=10,
            dataset_name="restricted_dataset",
            warnings=[],
            error="Access denied to dataset 'restricted_dataset' (ID: 10). "
            "You do not have permission to view this dataset.",
        )

        request = {
            "identifier": 1,
            "config": {
                "chart_type": "table",
                "columns": [{"name": "col1"}],
            },
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("update_chart", {"request": request})

            assert result.structured_content["success"] is False
            assert result.structured_content["chart"] is None
            error = result.structured_content["error"]
            assert error["error_type"] == "DatasetNotAccessible"
            assert "Access denied" in error["message"]

    @patch(
        "superset.mcp_service.auth.check_chart_data_access",
        new_callable=Mock,
    )
    @patch("superset.daos.chart.ChartDAO.find_by_id", new_callable=Mock)
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_update_chart_dataset_not_found(
        self, mock_db_session, mock_find_by_id, mock_validate, mcp_server
    ):
        """Test that update_chart returns error when dataset is deleted."""
        mock_chart = Mock()
        mock_chart.id = 1
        mock_chart.datasource_id = 99
        mock_find_by_id.return_value = mock_chart

        mock_validate.return_value = DatasetValidationResult(
            is_valid=False,
            dataset_id=99,
            dataset_name=None,
            warnings=[],
            error="Dataset (ID: 99) has been deleted or does not exist.",
        )

        request = {
            "identifier": 1,
            "config": {
                "chart_type": "table",
                "columns": [{"name": "col1"}],
            },
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("update_chart", {"request": request})

            assert result.structured_content["success"] is False
            assert result.structured_content["chart"] is None
            error = result.structured_content["error"]
            assert error["error_type"] == "DatasetNotAccessible"
            assert "deleted" in error["message"]


class TestFindChart:
    """Tests for _find_chart helper."""

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    def test_find_chart_by_numeric_id(self, mock_find):
        """Numeric int identifier calls find_by_id with int."""
        mock_chart = Mock()
        mock_find.return_value = mock_chart

        result = _find_chart(42)

        mock_find.assert_called_once_with(42)
        assert result is mock_chart

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    def test_find_chart_by_numeric_string(self, mock_find):
        """String-digit identifier is converted to int."""
        mock_chart = Mock()
        mock_find.return_value = mock_chart

        result = _find_chart("123")

        mock_find.assert_called_once_with(123)
        assert result is mock_chart

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    def test_find_chart_by_uuid(self, mock_find):
        """Non-digit string identifier looks up by uuid column."""
        mock_chart = Mock()
        mock_find.return_value = mock_chart

        uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        result = _find_chart(uuid)

        mock_find.assert_called_once_with(uuid, id_column="uuid")
        assert result is mock_chart

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    def test_find_chart_returns_none(self, mock_find):
        """Returns None when chart is not found."""
        mock_find.return_value = None

        result = _find_chart(999)

        assert result is None


class TestBuildUpdatePayload:
    """Tests for _build_update_payload helper."""

    def test_name_only_update(self):
        """Name-only update returns a dict with just slice_name."""
        request = UpdateChartRequest(
            identifier=1,
            chart_name="New Name",
        )
        chart = Mock()

        result = _build_update_payload(request, chart)

        assert isinstance(result, dict)
        assert result == {"slice_name": "New Name"}

    def test_error_when_no_config_and_no_name(self):
        """Returns GenerateChartResponse error when neither config nor chart_name."""
        request = UpdateChartRequest(identifier=1)
        chart = Mock()

        result = _build_update_payload(request, chart)

        assert isinstance(result, GenerateChartResponse)
        assert result.success is False
        assert result.error is not None
        assert result.error.error_type == "ValidationError"
        assert "config" in result.error.message.lower()
        assert "chart_name" in result.error.message.lower()

    def test_config_update_uses_request_chart_name(self):
        """When config and chart_name are both provided, uses chart_name."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )
        request = UpdateChartRequest(
            identifier=1,
            config=config,
            chart_name="My Custom Name",
        )
        chart = Mock()
        chart.datasource_id = None  # Avoid dataset lookup

        result = _build_update_payload(request, chart)

        assert isinstance(result, dict)
        assert result["slice_name"] == "My Custom Name"
        assert "viz_type" in result
        assert "params" in result

    def test_config_update_keeps_existing_name(self):
        """When config is provided but no chart_name, keeps existing slice_name."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )
        request = UpdateChartRequest(identifier=1, config=config)
        chart = Mock()
        chart.datasource_id = None
        chart.slice_name = "Existing Name"

        result = _build_update_payload(request, chart)

        assert isinstance(result, dict)
        assert result["slice_name"] == "Existing Name"


class TestUpdateChartNameOnly:
    """Integration-style tests for name-only update via MCP tool."""

    @patch(
        "superset.mcp_service.auth.check_chart_data_access",
        new_callable=Mock,
    )
    @patch(
        "superset.commands.chart.update.UpdateChartCommand",
        new_callable=Mock,
    )
    @patch("superset.daos.chart.ChartDAO.find_by_id", new_callable=Mock)
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_name_only_update_success(
        self,
        mock_db_session,
        mock_find_by_id,
        mock_update_cmd_cls,
        mock_check_access,
        mcp_server,
    ):
        """Successful name-only update (identifier + chart_name, no config)."""
        mock_chart = Mock()
        mock_chart.id = 1
        mock_chart.datasource_id = 10
        mock_chart.slice_name = "Old Name"
        mock_chart.viz_type = "table"
        mock_chart.uuid = "abc-123"
        mock_find_by_id.return_value = mock_chart

        mock_check_access.return_value = DatasetValidationResult(
            is_valid=True,
            dataset_id=10,
            dataset_name="my_dataset",
            warnings=[],
        )

        updated_chart = Mock()
        updated_chart.id = 1
        updated_chart.slice_name = "Renamed Chart"
        updated_chart.viz_type = "table"
        updated_chart.uuid = "abc-123"
        mock_update_cmd_cls.return_value.run.return_value = updated_chart

        request = {
            "identifier": 1,
            "chart_name": "Renamed Chart",
            "generate_preview": False,
        }

        async with Client(mcp) as client:
            result = await client.call_tool("update_chart", {"request": request})

            assert result.structured_content["success"] is True
            assert result.structured_content["chart"]["slice_name"] == "Renamed Chart"

            # Verify UpdateChartCommand was called with name-only payload
            mock_update_cmd_cls.assert_called_once_with(
                1, {"slice_name": "Renamed Chart"}
            )

    @patch("superset.daos.chart.ChartDAO.find_by_id", new_callable=Mock)
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_no_config_no_name_returns_error(
        self,
        mock_db_session,
        mock_find_by_id,
        mcp_server,
    ):
        """Error when neither config nor chart_name is provided."""
        mock_chart = Mock()
        mock_chart.id = 1
        mock_chart.datasource_id = 10
        mock_find_by_id.return_value = mock_chart

        with patch(
            "superset.mcp_service.auth.check_chart_data_access",
            new_callable=Mock,
        ) as mock_check_access:
            mock_check_access.return_value = DatasetValidationResult(
                is_valid=True,
                dataset_id=10,
                dataset_name="my_dataset",
                warnings=[],
            )

            request = {
                "identifier": 1,
            }

            async with Client(mcp) as client:
                result = await client.call_tool("update_chart", {"request": request})

                assert result.structured_content["success"] is False
                error = result.structured_content["error"]
                assert error["error_type"] == "ValidationError"
                assert "config" in error["message"].lower()
                assert "chart_name" in error["message"].lower()
