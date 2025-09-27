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

from superset.mcp_service.app import mcp
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
async def test_chart_configs_resource_exists(mcp_server):
    """Test chart configs resource is registered and accessible"""
    async with Client(mcp_server) as client:
        # List all resources
        resources = await client.list_resources()

        # Check that superset://chart/configs exists
        resource_uris = [str(r.uri) for r in resources]
        assert "superset://chart/configs" in resource_uris


@pytest.mark.asyncio
async def test_instance_metadata_resource_content(mcp_server):
    """Test instance metadata resource returns valid JSON with InstanceInfo structure"""
    # Mock DAOs to avoid database access - patch at their source
    with (
        patch("superset.daos.dataset.DatasetDAO") as mock_dataset_dao,
        patch("superset.daos.dashboard.DashboardDAO") as mock_dashboard_dao,
        patch("superset.daos.chart.ChartDAO") as mock_chart_dao,
        patch("superset.daos.database.DatabaseDAO") as mock_database_dao,
        patch("superset.daos.user.UserDAO") as mock_user_dao,
        patch("superset.daos.tag.TagDAO") as mock_tag_dao,
        patch("superset.extensions.db") as mock_db,
    ):
        # Mock DAO counts
        mock_dataset_dao.count.return_value = 10
        mock_dashboard_dao.count.return_value = 5
        mock_chart_dao.count.return_value = 20
        mock_database_dao.count.return_value = 3
        mock_user_dao.count.return_value = 8
        mock_tag_dao.count.return_value = 15

        # Mock list results for time-based metrics
        mock_dataset_dao.list.return_value = ([], 0)
        mock_dashboard_dao.list.return_value = ([], 0)
        mock_chart_dao.list.return_value = ([], 0)

        # Mock Role query for instance summary
        mock_role_query = mock_db.session.query.return_value
        mock_role_query.count.return_value = 4

        # Mock dashboard breakdown queries
        mock_dashboard_dao.count.return_value = 5  # For published count

        # Mock database type query
        mock_db_query = mock_db.session.query.return_value
        mock_db_query.all.return_value = []

        # Mock dashboard with charts query
        mock_dashboard_query = mock_db.session.query.return_value
        mock_dashboard_join = mock_dashboard_query.join.return_value
        mock_dashboard_join.distinct.return_value.count.return_value = 3

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

            # Parse and validate JSON - now expects InstanceInfo structure
            metadata = json.loads(content.text)

            # Check new InstanceInfo structure
            assert "instance_summary" in metadata
            assert "recent_activity" in metadata
            assert "dashboard_breakdown" in metadata
            assert "database_breakdown" in metadata
            assert "popular_content" in metadata
            assert "timestamp" in metadata

            # Check instance_summary fields
            instance_summary = metadata["instance_summary"]
            assert instance_summary["total_datasets"] == 10
            assert instance_summary["total_dashboards"] == 5
            assert instance_summary["total_charts"] == 20
            assert instance_summary["total_databases"] == 3
            assert instance_summary["total_users"] == 8
            assert instance_summary["total_roles"] == 4
            assert instance_summary["total_tags"] == 15


@pytest.mark.asyncio
async def test_chart_configs_resource_content(mcp_server):
    """Test chart configs resource returns valid JSON with ChartConfig examples"""
    async with Client(mcp_server) as client:
        # Get the resource
        resource = await client.read_resource("superset://chart/configs")

        # Check the response
        assert resource is not None
        assert len(resource) > 0

        # Check first content item
        content = resource[0]
        # FastMCP returns resources as text/plain by default
        assert content.mimeType == "text/plain"

        # Parse and validate JSON
        data = json.loads(content.text)
        assert "xy_chart_configs" in data
        assert "table_chart_configs" in data
        assert "schema_reference" in data
        assert "best_practices" in data
        assert "common_patterns" in data

        # Check XY chart config examples
        xy_configs = data["xy_chart_configs"]
        assert "line_chart" in xy_configs
        assert "bar_chart" in xy_configs
        assert "scatter_plot" in xy_configs

        # Validate line chart config structure matches ChartConfig schema
        line_config = xy_configs["line_chart"]["config"]
        assert line_config["chart_type"] == "xy"
        assert line_config["kind"] == "line"
        assert "x" in line_config
        assert "y" in line_config
        assert "name" in line_config["x"]
        assert isinstance(line_config["y"], list)
        assert len(line_config["y"]) > 0

        # Check table chart config examples
        table_configs = data["table_chart_configs"]
        assert "basic_table" in table_configs
        assert "aggregated_table" in table_configs

        # Validate basic table config structure
        table_config = table_configs["basic_table"]["config"]
        assert table_config["chart_type"] == "table"
        assert "columns" in table_config
        assert isinstance(table_config["columns"], list)
        assert len(table_config["columns"]) > 0

        # Check schema reference
        schema_ref = data["schema_reference"]
        assert "ChartConfig" in schema_ref
        assert "XYChartConfig" in schema_ref
        assert "TableChartConfig" in schema_ref
        assert "ColumnRef" in schema_ref


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
