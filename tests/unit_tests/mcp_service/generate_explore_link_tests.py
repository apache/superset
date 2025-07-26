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

"""Tests for generate_explore_link MCP tool"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastmcp import Client

from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    ColumnRef,
    FilterConfig,
    GenerateExploreLinkRequest,
    TableChartConfig,
)


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture
def mock_user():
    """Mock user for testing."""
    user = SimpleNamespace()
    user.username = "admin"
    return user


class TestGenerateExploreLink:
    """Test generate_explore_link MCP tool"""

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_basic_explore_link(self, mock_create_form_data, mcp_server):
        """Test generating a basic explore link."""
        mock_create_form_data.return_value = "basic_test_key"

        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="revenue", aggregate="SUM"),
                ColumnRef(name="orders", aggregate="COUNT"),
                ColumnRef(name="region"),
                ColumnRef(name="product"),
            ],
        )
        request = GenerateExploreLinkRequest(dataset_id="15", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            # Verify response structure
            assert result.data["error"] is None
            assert "/explore/?" in result.data["url"]

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_with_filters(
        self, mock_create_form_data, mcp_server
    ):
        """Test generating explore link with filters."""
        mock_create_form_data.return_value = "filters_test_key"

        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="sales", aggregate="SUM")],
            filters=[
                FilterConfig(column="country", op="=", value="USA"),
                FilterConfig(column="revenue", op=">", value="1000"),
            ],
        )
        request = GenerateExploreLinkRequest(dataset_id="10", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            # Verify response
            assert result.data["error"] is None
            assert "/explore/?" in result.data["url"]

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_no_params(
        self, mock_create_form_data, mcp_server
    ):
        """Test generating explore link with minimal parameters."""
        mock_create_form_data.return_value = "minimal_test_key"

        config = TableChartConfig(chart_type="table", columns=[ColumnRef(name="col1")])
        request = GenerateExploreLinkRequest(dataset_id="5", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            # Verify response
            assert result.data["error"] is None
            assert "/explore/?" in result.data["url"]
