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

"""Tests for the schema discovery MCP resources (superset://schema/*)."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client, FastMCP
from fastmcp.exceptions import McpError

from superset.mcp_service.app import mcp
from superset.mcp_service.system.resources.schema_discovery import (
    _build_schema_resource,
)
from superset.utils import json

RESOURCE_URIS: dict[str, str] = {
    "chart": "superset://schema/chart",
    "dataset": "superset://schema/dataset",
    "dashboard": "superset://schema/dashboard",
    "all": "superset://schema/all",
}


@pytest.fixture
def mcp_server() -> FastMCP:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


async def _read_resource(mcp_server: FastMCP, uri: str) -> dict[str, Any]:
    async with Client(mcp_server) as client:
        result = await client.read_resource(uri)
    return json.loads(result[0].text)


class TestSchemaDiscoveryResourceRegistration:
    """URI pattern matching: resources are discoverable under superset://schema/*."""

    @pytest.mark.asyncio
    async def test_all_schema_resources_registered(self, mcp_server: FastMCP) -> None:
        async with Client(mcp_server) as client:
            resources = await client.list_resources()

        resource_uris = {str(resource.uri) for resource in resources}
        for uri in RESOURCE_URIS.values():
            assert uri in resource_uris


class TestSchemaDiscoveryResourceSuccessPaths:
    """Success paths for each model-specific and combined schema resource."""

    @pytest.mark.asyncio
    async def test_chart_schema_resource(self, mcp_server: FastMCP) -> None:
        data = await _read_resource(mcp_server, RESOURCE_URIS["chart"])

        assert data["model_type"] == "chart"
        assert data["select_columns"], "expected non-empty select_columns"
        assert "id" in data["all_column_names"]
        assert data["default_sort"] == "changed_on"
        assert data["default_sort_direction"] == "desc"
        for column in data["select_columns"]:
            assert set(column.keys()) == {"name", "description", "type"}

    @pytest.mark.asyncio
    async def test_dataset_schema_resource(self, mcp_server: FastMCP) -> None:
        data = await _read_resource(mcp_server, RESOURCE_URIS["dataset"])

        assert data["model_type"] == "dataset"
        assert data["select_columns"]
        assert "table_name" in data["all_column_names"]

    @pytest.mark.asyncio
    async def test_dashboard_schema_resource(self, mcp_server: FastMCP) -> None:
        data = await _read_resource(mcp_server, RESOURCE_URIS["dashboard"])

        assert data["model_type"] == "dashboard"
        assert data["select_columns"]
        assert "dashboard_title" in data["all_column_names"]

    @pytest.mark.asyncio
    async def test_all_schemas_resource_combines_all_model_types(
        self, mcp_server: FastMCP
    ) -> None:
        data = await _read_resource(mcp_server, RESOURCE_URIS["all"])

        assert set(data.keys()) == {"chart", "dataset", "dashboard", "metadata"}
        assert data["chart"]["model_type"] == "chart"
        assert data["dataset"]["model_type"] == "dataset"
        assert data["dashboard"]["model_type"] == "dashboard"
        assert "usage" in data["metadata"]


class TestSchemaDiscoveryResourceErrorHandling:
    """Error handling for invalid requests against the schema resources."""

    @pytest.mark.asyncio
    async def test_unregistered_uri_raises(self, mcp_server: FastMCP) -> None:
        async with Client(mcp_server) as client:
            with pytest.raises(McpError, match="Unknown resource"):
                await client.read_resource("superset://schema/nonexistent")

    def test_build_schema_resource_returns_empty_dict_for_unknown_model_type(
        self,
    ) -> None:
        assert _build_schema_resource("unknown") == {}
