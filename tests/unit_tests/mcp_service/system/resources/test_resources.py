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

"""Tests for MCP resources"""

from unittest.mock import patch

import pytest
from fastmcp import Client

from superset.mcp_service.mcp_app import mcp
from superset.utils import json


@pytest.fixture
def mcp_server():
    """Fixture that returns the MCP server instance"""
    return mcp


@pytest.mark.asyncio
async def test_instance_metadata_resource_exists(mcp_server):
    """Test instance metadata resource is registered and accessible"""
    async with Client(mcp_server) as client:
        # List all resources
        resources = await client.list_resources()

        # Check that superset://instance/metadata exists
        resource_uris = [str(r.uri) for r in resources]
        assert "superset://instance/metadata" in resource_uris


@pytest.mark.asyncio
async def test_chart_templates_resource_exists(mcp_server):
    """Test chart templates resource is registered and accessible"""
    async with Client(mcp_server) as client:
        # List all resources
        resources = await client.list_resources()

        # Check that superset://chart/templates exists
        resource_uris = [str(r.uri) for r in resources]
        assert "superset://chart/templates" in resource_uris


@pytest.mark.asyncio
async def test_instance_metadata_resource_content(mcp_server):
    """Test instance metadata resource returns valid JSON"""
    # Mock DAOs to avoid database access - patch at their source
    with (
        patch("superset.daos.dataset.DatasetDAO") as mock_dataset_dao,
        patch("superset.daos.dashboard.DashboardDAO") as mock_dashboard_dao,
        patch("superset.daos.chart.ChartDAO") as mock_chart_dao,
        patch("superset.daos.database.DatabaseDAO") as mock_database_dao,
        patch("superset.extensions.db"),
    ):
        # Mock DAO counts
        mock_dataset_dao.count.return_value = 10
        mock_dashboard_dao.count.return_value = 5
        mock_chart_dao.count.return_value = 20
        mock_database_dao.count.return_value = 3

        # Mock model classes
        mock_dataset_dao.model_cls = None
        mock_chart_dao.model_cls = None

        # Mock list results
        mock_dashboard_dao.list.return_value = ([], 0)
        mock_database_dao.list.return_value = ([], 0)

        async with Client(mcp_server) as client:
            # Get the resource
            resource = await client.read_resource("superset://instance/metadata")

            # Parse the JSON content
            assert resource is not None
            assert len(resource) > 0

            # Check first content item
            content = resource[0]
            # FastMCP returns resources as text/plain by default
            assert content.mimeType == "text/plain"

            # Parse and validate JSON
            metadata = json.loads(content.text)
            assert "instance_stats" in metadata
            assert metadata["instance_stats"]["dataset_count"] == 10
            assert metadata["instance_stats"]["dashboard_count"] == 5
            assert metadata["instance_stats"]["chart_count"] == 20
            assert metadata["instance_stats"]["database_count"] == 3


@pytest.mark.asyncio
async def test_chart_templates_resource_content(mcp_server):
    """Test chart templates resource returns valid JSON"""
    async with Client(mcp_server) as client:
        # Get the resource
        resource = await client.read_resource("superset://chart/templates")

        # Check the response
        assert resource is not None
        assert len(resource) > 0

        # Check first content item
        content = resource[0]
        # FastMCP returns resources as text/plain by default
        assert content.mimeType == "text/plain"

        # Parse and validate JSON
        data = json.loads(content.text)
        assert "templates" in data
        assert "color_schemes" in data
        assert "performance_tips" in data
        assert "chart_selection_guide" in data

        # Check specific templates exist
        assert "line_chart" in data["templates"]
        assert "bar_chart" in data["templates"]
        assert "pie_chart" in data["templates"]
        assert "table" in data["templates"]
        assert "scatter_plot" in data["templates"]

        # Check template structure
        line_template = data["templates"]["line_chart"]
        assert "description" in line_template
        assert "viz_type" in line_template
        assert "configuration" in line_template
        assert "best_practices" in line_template


@pytest.mark.asyncio
async def test_list_all_resources(mcp_server):
    """Test listing all available resources"""
    async with Client(mcp_server) as client:
        # List all resources
        resources = await client.list_resources()

        # We should have at least our two resources
        assert len(resources) >= 2

        # Check resource structure
        for resource in resources:
            assert hasattr(resource, "uri")
            assert hasattr(resource, "name")
            assert hasattr(resource, "description")
