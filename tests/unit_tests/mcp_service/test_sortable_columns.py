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

"""Tests for sortable columns in list tools."""

from unittest.mock import MagicMock, patch

import pytest

from superset.mcp_service.chart.tool.list_charts import (
    list_charts,
    SORTABLE_CHART_COLUMNS,
)
from superset.mcp_service.dashboard.tool.list_dashboards import (
    list_dashboards,
    SORTABLE_DASHBOARD_COLUMNS,
)
from superset.mcp_service.dataset.tool.list_datasets import (
    list_datasets,
    SORTABLE_DATASET_COLUMNS,
)
from superset.mcp_service.schemas.chart_schemas import ListChartsRequest
from superset.mcp_service.schemas.dashboard_schemas import (
    ListDashboardsRequest,
)
from superset.mcp_service.schemas.dataset_schemas import ListDatasetsRequest


class TestSortableColumns:
    """Test sortable columns configuration."""

    def test_dataset_sortable_columns(self):
        """Test that dataset sortable columns are properly defined."""
        assert SORTABLE_DATASET_COLUMNS == [
            "id",
            "table_name",
            "schema",
            "changed_on",
            "created_on",
        ]
        # Ensure no computed properties are included
        assert "changed_on_delta_humanized" not in SORTABLE_DATASET_COLUMNS
        assert "changed_by_name" not in SORTABLE_DATASET_COLUMNS
        assert "database_name" not in SORTABLE_DATASET_COLUMNS
        assert "uuid" not in SORTABLE_DATASET_COLUMNS

    def test_chart_sortable_columns(self):
        """Test that chart sortable columns are properly defined."""
        assert SORTABLE_CHART_COLUMNS == [
            "id",
            "slice_name",
            "viz_type",
            "datasource_name",
            "description",
            "changed_on",
            "created_on",
        ]
        # Ensure no computed properties are included
        assert "changed_on_delta_humanized" not in SORTABLE_CHART_COLUMNS
        assert "changed_by_name" not in SORTABLE_CHART_COLUMNS
        assert "uuid" not in SORTABLE_CHART_COLUMNS

    def test_dashboard_sortable_columns(self):
        """Test that dashboard sortable columns are properly defined."""
        assert SORTABLE_DASHBOARD_COLUMNS == [
            "id",
            "dashboard_title",
            "slug",
            "published",
            "changed_on",
            "created_on",
        ]
        # Ensure no computed properties are included
        assert "changed_on_delta_humanized" not in SORTABLE_DASHBOARD_COLUMNS
        assert "changed_by_name" not in SORTABLE_DASHBOARD_COLUMNS
        assert "uuid" not in SORTABLE_DASHBOARD_COLUMNS

    @patch("superset.daos.dataset.DatasetDAO")
    @patch("superset.mcp_service.auth.get_user_from_request")
    def test_list_datasets_with_valid_order_column(
        self, mock_get_user, mock_dataset_dao
    ):
        """Test list_datasets with valid order column."""
        mock_get_user.return_value = MagicMock(id=1)
        mock_tool = MagicMock()
        mock_tool.run.return_value = MagicMock(datasets=[], count=0)

        with patch(
            "superset.mcp_service.dataset.tool.list_datasets.ModelListTool",
            return_value=mock_tool,
        ):
            # Test with valid sortable column
            request = ListDatasetsRequest(
                order_column="table_name", order_direction="asc"
            )
            list_datasets.fn(request)

            # Verify the tool was called with the correct order column
            mock_tool.run.assert_called_once()
            call_args = mock_tool.run.call_args[1]
            assert call_args["order_column"] == "table_name"
            assert call_args["order_direction"] == "asc"

    @patch("superset.daos.dataset.DatasetDAO")
    @patch("superset.mcp_service.auth.get_user_from_request")
    def test_list_datasets_with_invalid_order_column_rejected_by_dao(
        self, mock_get_user, mock_dataset_dao
    ):
        """Test that invalid order columns are passed to DAO and rejected there."""
        mock_get_user.return_value = MagicMock(id=1)
        mock_tool = MagicMock()
        # Simulate DAO rejecting invalid column
        mock_tool.run.side_effect = Exception(
            "ORDER BY column changed_on_delta_humanized not found"
        )

        with patch(
            "superset.mcp_service.dataset.tool.list_datasets.ModelListTool",
            return_value=mock_tool,
        ):
            # Test with computed property (invalid for sorting)
            request = ListDatasetsRequest(order_column="changed_on_delta_humanized")

            with pytest.raises(Exception, match="changed_on_delta_humanized not found"):
                list_datasets.fn(request)

    @patch("superset.daos.chart.ChartDAO")
    @patch("superset.mcp_service.auth.get_user_from_request")
    def test_list_charts_with_valid_order_column(self, mock_get_user, mock_chart_dao):
        """Test list_charts with valid order column."""
        mock_get_user.return_value = MagicMock(id=1)
        mock_tool = MagicMock()
        mock_tool.run.return_value = MagicMock(charts=[], count=0)

        with patch(
            "superset.mcp_service.chart.tool.list_charts.ModelListTool",
            return_value=mock_tool,
        ):
            # Test with valid sortable column
            request = ListChartsRequest(
                order_column="slice_name", order_direction="asc"
            )
            list_charts.fn(request)

            # Verify the tool was called with the correct order column
            mock_tool.run.assert_called_once()
            call_args = mock_tool.run.call_args[1]
            assert call_args["order_column"] == "slice_name"
            assert call_args["order_direction"] == "asc"

    @patch("superset.daos.dashboard.DashboardDAO")
    @patch("superset.mcp_service.auth.get_user_from_request")
    def test_list_dashboards_with_valid_order_column(
        self, mock_get_user, mock_dashboard_dao
    ):
        """Test list_dashboards with valid order column."""
        mock_get_user.return_value = MagicMock(id=1)
        mock_tool = MagicMock()
        mock_tool.run.return_value = MagicMock(dashboards=[], count=0)

        with patch(
            "superset.mcp_service.dashboard.tool.list_dashboards.ModelListTool",
            return_value=mock_tool,
        ):
            # Test with valid sortable column
            request = ListDashboardsRequest(
                order_column="dashboard_title", order_direction="desc"
            )
            list_dashboards.fn(request)

            # Verify the tool was called with the correct order column
            mock_tool.run.assert_called_once()
            call_args = mock_tool.run.call_args[1]
            assert call_args["order_column"] == "dashboard_title"
            assert call_args["order_direction"] == "desc"

    def test_sortable_columns_in_docstrings(self):
        """Test that sortable columns are documented in tool docstrings."""
        # Check list_datasets docstring (stored in description after @mcp.tool)
        assert hasattr(list_datasets, "description")
        assert "Sortable columns for order_column:" in list_datasets.description
        for col in SORTABLE_DATASET_COLUMNS:
            assert col in list_datasets.description

        # Check list_charts docstring
        assert hasattr(list_charts, "description")
        assert "Sortable columns for order_column:" in list_charts.description
        for col in SORTABLE_CHART_COLUMNS:
            assert col in list_charts.description

        # Check list_dashboards docstring
        assert hasattr(list_dashboards, "description")
        assert "Sortable columns for order_column:" in list_dashboards.description
        for col in SORTABLE_DASHBOARD_COLUMNS:
            assert col in list_dashboards.description

    def test_default_ordering(self):
        """Test default ordering behavior."""
        # Test datasets default to changed_on desc
        with patch(
            "superset.mcp_service.dataset.tool.list_datasets.ModelListTool"
        ) as mock_tool:
            with patch("superset.mcp_service.auth.get_user_from_request"):
                mock_tool.return_value.run.return_value = MagicMock(
                    datasets=[], count=0
                )
                request = ListDatasetsRequest()  # No order specified
                list_datasets.fn(request)

                call_args = mock_tool.return_value.run.call_args[1]
                assert call_args["order_column"] == "changed_on"
                assert call_args["order_direction"] == "desc"
