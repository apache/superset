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
Unit tests for MCP tool error handling and parameter validation
"""
import logging
import sys
from unittest.mock import patch

import pytest

sys.path.append('.')
from superset.mcp_service.mcp_app import mcp

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@pytest.fixture
def mcp_server():
    return mcp

class TestErrorHandling:
    """Test error handling and parameter validation in MCP tools"""

    @patch('superset.daos.dashboard.DashboardDAO.list')
    @pytest.mark.asyncio
    async def test_list_dashboards_exception_handling(self, mock_list, mcp_server):
        import fastmcp
        mock_list.side_effect = Exception("Unexpected error")
        async with fastmcp.Client(mcp_server) as client:
            with pytest.raises(Exception) as excinfo:
                await client.call_tool("list_dashboards", {})
        assert "Unexpected error" in str(excinfo.value)

    @pytest.mark.xfail(reason="MCP protocol bug: dict fields named column_operators are deserialized as custom types (Column_Operators). TODO: revisit after protocol fix.")
    @pytest.mark.asyncio
    async def test_get_dashboard_available_filters_exception_handling(self, mcp_server):
        import fastmcp
        async with fastmcp.Client(mcp_server) as client:
            result = await client.call_tool("get_dashboard_available_filters")
            assert hasattr(result.data, "filters")
            assert hasattr(result.data, "operators")
            assert hasattr(result.data, "columns")

    @patch('superset.daos.dataset.DatasetDAO.list')
    @pytest.mark.asyncio
    async def test_list_datasets_exception_handling(self, mock_list, mcp_server):
        import fastmcp
        mock_list.side_effect = Exception("API request failed")
        async with fastmcp.Client(mcp_server) as client:
            with pytest.raises(Exception) as excinfo:
                await client.call_tool("list_datasets", {})
        assert "API request failed" in str(excinfo.value)

    @pytest.mark.asyncio
    async def test_list_dashboards_parameter_types(self, mcp_server):
        import fastmcp
        with patch('superset.daos.dashboard.DashboardDAO.list') as mock_list:
            mock_list.return_value = ([], 0)
            async with fastmcp.Client(mcp_server) as client:
                with pytest.raises(fastmcp.exceptions.ToolError):
                    await client.call_tool("list_dashboards", {"filters": '[{"col": "test", "opr": "eq", "value": "value"}]'})
                with pytest.raises(fastmcp.exceptions.ToolError):
                    await client.call_tool("list_dashboards", {"filters": [{"col": "test", "opr": "eq", "value": "value"}]})
                with pytest.raises(fastmcp.exceptions.ToolError):
                    await client.call_tool("list_dashboards", {"select_columns": "id,dashboard_title"})
                await client.call_tool("list_dashboards", {"select_columns": ["id", "dashboard_title"]})

    @pytest.mark.asyncio
    async def test_list_datasets_parameter_types(self, mcp_server):
        import fastmcp
        with patch('superset.daos.dataset.DatasetDAO.list') as mock_list:
            mock_list.return_value = ([], 0)
            async with fastmcp.Client(mcp_server) as client:
                with pytest.raises(fastmcp.exceptions.ToolError):
                    await client.call_tool("list_datasets", {"filters": '[{"col": "test", "opr": "eq", "value": "value"}]'})
                with pytest.raises(fastmcp.exceptions.ToolError):
                    await client.call_tool("list_datasets", {"filters": [{"col": "test", "opr": "eq", "value": "value"}]})
                with pytest.raises(fastmcp.exceptions.ToolError):
                    await client.call_tool("list_datasets", {"select_columns": "id,table_name"})
                await client.call_tool("list_datasets", {"select_columns": ["id", "table_name"]})

    # Example: test for missing required param, extra param, and malformed input would be in protocol/integration tests 
