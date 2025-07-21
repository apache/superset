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
Protocol/integration tests for MCP service using fastmcp.Client
"""

import pytest
from fastmcp.client.client import CallToolResult
from fastmcp.exceptions import ToolError
from pydantic_core._pydantic_core import ValidationError


class TestFastMCPInMemoryProtocol:
    """
    In-memory protocol-level tests for the FastMCP server.
    These tests require pytest-asyncio to be installed and enabled.
    """

    @pytest.mark.asyncio
    async def test_tool_listing(self):
        from superset.mcp_service.server import init_fastmcp_server

        mcp = init_fastmcp_server()
        from fastmcp import Client

        async with Client(mcp) as client:
            tools = await client.list_tools()
            tool_names = [t.name for t in tools]
            expected = [
                "list_dashboards",
                "get_dashboard_info",
                "get_superset_instance_info",
                "get_dashboard_available_filters",
                "get_dataset_available_filters",
                "list_datasets",
                "list_charts",
                "get_chart_info",
                "get_chart_available_filters",
                "get_dataset_info",
                "create_chart_simple",
            ]
            for name in expected:
                assert name in tool_names

    @pytest.mark.asyncio
    async def test_valid_list_dashboards_call(self):
        from superset.mcp_service.server import init_fastmcp_server

        mcp = init_fastmcp_server()
        from fastmcp import Client

        async with Client(mcp) as client:
            result = await client.call_tool(
                "list_dashboards", {"page": 1, "page_size": 2}
            )
            assert isinstance(result, CallToolResult)
            assert hasattr(result, "data")
            assert hasattr(result, "structured_content")
            assert hasattr(result.data, "dashboards")
            assert hasattr(result.data, "count")

    @pytest.mark.asyncio
    async def test_missing_required_param(self):
        from superset.mcp_service.server import init_fastmcp_server

        mcp = init_fastmcp_server()
        from fastmcp import Client

        async with Client(mcp) as client:
            result = await client.call_tool("list_dashboards", {"page_size": 2})
            assert isinstance(result, CallToolResult)
            assert hasattr(result, "data")
            assert hasattr(result, "structured_content")
            assert hasattr(result.data, "dashboards")
            assert hasattr(result.data, "count")

    @pytest.mark.asyncio
    async def test_wrong_type_param(self):
        from superset.mcp_service.server import init_fastmcp_server

        mcp = init_fastmcp_server()
        from fastmcp import Client

        async with Client(mcp) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "list_dashboards", {"page": "not_an_int", "page_size": 2}
                )

    @pytest.mark.asyncio
    async def test_extra_param(self):
        from superset.mcp_service.server import init_fastmcp_server

        mcp = init_fastmcp_server()
        from fastmcp import Client

        async with Client(mcp) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "list_dashboards", {"page": 1, "page_size": 2, "unexpected": 123}
                )

    @pytest.mark.asyncio
    async def test_malformed_input(self):
        from superset.mcp_service.server import init_fastmcp_server

        mcp = init_fastmcp_server()
        from fastmcp import Client

        async with Client(mcp) as client:
            with pytest.raises(ValidationError):
                await client.call_tool("list_dashboards", "this is not a dict")

    @pytest.mark.asyncio
    async def test_error_envelope_on_internal_error(self):
        from superset.mcp_service.server import init_fastmcp_server

        mcp = init_fastmcp_server()
        from fastmcp import Client

        async with Client(mcp) as client:
            with pytest.raises(ToolError):
                await client.call_tool("not_a_real_tool", {})
