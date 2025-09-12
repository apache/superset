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
Unit tests for MCP system tools (get_superset_instance_info)
"""

import logging
import sys
from unittest.mock import patch

import pytest

sys.path.append(".")
import fastmcp

from superset.mcp_service.app import mcp

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


class TestSystemTools:
    """Test system-related MCP tools"""

    @patch("superset.daos.dashboard.DashboardDAO.count", return_value=10)
    @patch("superset.daos.chart.ChartDAO.count", return_value=10)
    @patch("superset.daos.dataset.DatasetDAO.count", return_value=10)
    @patch("superset.daos.database.DatabaseDAO.count", return_value=10)
    @patch("superset.daos.user.UserDAO.count", return_value=10)
    @patch("superset.daos.tag.TagDAO.count", return_value=10)
    @pytest.mark.asyncio
    async def test_get_superset_instance_info_success(
        self,
        mock_tag,
        mock_user,
        mock_db,
        mock_dataset,
        mock_chart,
        mock_dashboard,
        mcp_server,
    ):
        async with fastmcp.Client(mcp_server) as client:
            result = await client.call_tool(
                "get_superset_instance_info", {"request": {}}
            )
            summary = result.data.instance_summary
            assert summary.total_dashboards == 10
            assert summary.total_charts == 10
            assert summary.total_datasets == 10
            assert summary.total_databases == 10
            assert summary.total_users == 10
            assert summary.total_tags == 10

    @patch(
        "superset.daos.dashboard.DashboardDAO.count",
        side_effect=Exception("Database connection failed"),
    )
    @patch("superset.daos.chart.ChartDAO.count", return_value=5)
    @patch("superset.daos.dataset.DatasetDAO.count", return_value=3)
    @patch("superset.daos.database.DatabaseDAO.count", return_value=2)
    @patch("superset.daos.user.UserDAO.count", return_value=4)
    @patch("superset.daos.tag.TagDAO.count", return_value=1)
    @pytest.mark.asyncio
    async def test_get_superset_instance_info_failure(
        self,
        mock_tag,
        mock_user,
        mock_db,
        mock_dataset,
        mock_chart,
        mock_dashboard,
        mcp_server,
    ):
        """Test that the tool handles DAO failures gracefully."""
        async with fastmcp.Client(mcp_server) as client:
            result = await client.call_tool(
                "get_superset_instance_info", {"request": {}}
            )

            # Should return a valid response even with DAO failures
            assert result.data is not None
            summary = result.data.instance_summary

            # Failed dashboard count should default to 0
            assert summary.total_dashboards == 0

            # Other counts should work normally
            assert summary.total_charts == 5
            assert summary.total_datasets == 3
            assert summary.total_databases == 2
            assert summary.total_users == 4
            assert summary.total_tags == 1

            # Should have valid breakdown structures with fallback values
            assert result.data.dashboard_breakdown.published == 0
            assert result.data.dashboard_breakdown.unpublished == 0

            # Check the structured content which shows the correct serialization
            assert result.structured_content["database_breakdown"]["by_type"] == {}
            assert result.data.popular_content.top_tags == []
