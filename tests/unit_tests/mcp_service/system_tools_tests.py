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

from superset.mcp_service.mcp_app import mcp

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
            result = await client.call_tool("get_superset_instance_info", {})
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
    @pytest.mark.asyncio
    async def test_get_superset_instance_info_failure(self, mock_dashboard, mcp_server):
        async with fastmcp.Client(mcp_server) as client:
            with pytest.raises(
                Exception, match="Database connection failed"
            ) as excinfo:
                await client.call_tool("get_superset_instance_info", {})
            assert "Database connection failed" in str(excinfo.value)
