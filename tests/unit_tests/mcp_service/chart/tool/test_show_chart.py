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
Unit tests for the ``show_chart`` MCP tool.
"""

from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.utils import json


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@pytest.fixture(autouse=True)
def mock_embedded_flag():
    """Enable EMBEDDED_SUPERSET for all tests; show_chart requires it."""
    with patch(
        "superset.mcp_service.chart.tool.show_chart.is_feature_enabled",
        return_value=True,
    ) as mock_flag:
        yield mock_flag


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture
def mock_chart():
    chart = MagicMock()
    chart.id = 42
    chart.uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    chart.slice_name = "Sales by region"
    chart.viz_type = "bar"
    chart.datasource_id = 7
    chart.datasource_type = "table"
    chart.datasource = MagicMock(id=7)
    chart.params = json.dumps({"viz_type": "bar", "metrics": ["count"]})
    return chart


@pytest.mark.asyncio
async def test_show_chart_tool_registered(mcp_server):
    """The ``show_chart`` tool should register with the MCP server."""
    tools = await mcp_server.list_tools()
    names = {t.name for t in tools}
    assert "show_chart" in names


@pytest.mark.asyncio
async def test_show_chart_declares_ui_resource(mcp_server):
    """The tool should advertise the ``ui://superset/chart-viewer`` resource."""
    tool = await mcp_server.get_tool("show_chart")
    meta = getattr(tool, "meta", None) or {}
    assert meta.get("ui", {}).get("resourceUri") == "ui://superset/chart-viewer"


@pytest.mark.asyncio
async def test_show_chart_not_found(mcp_server):
    """When the identifier doesn't resolve to a chart, return a structured error."""
    with (
        patch(
            "superset.mcp_service.chart.tool.show_chart.find_chart_by_identifier",
            return_value=None,
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.get_superset_base_url",
            return_value="http://superset.test",
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "show_chart", {"request": {"identifier": "nope"}}
            )
    data = json.loads(result.content[0].text)
    assert data["error"] == "Chart not found: nope"
    assert data["chart_id"] == 0
    assert data["explore_url"] == ""


@pytest.mark.asyncio
async def test_show_chart_access_denied(mcp_server, mock_chart):
    """When the user cannot access the chart, return a structured error."""
    with (
        patch(
            "superset.mcp_service.chart.tool.show_chart.find_chart_by_identifier",
            return_value=mock_chart,
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.security_manager",
            new_callable=MagicMock,
        ) as mock_sm,
        patch(
            "superset.mcp_service.chart.tool.show_chart.get_superset_base_url",
            return_value="http://superset.test",
        ),
    ):
        mock_sm.can_access_chart.return_value = False
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "show_chart", {"request": {"identifier": "42"}}
            )
    data = json.loads(result.content[0].text)
    assert data["error"] == "You do not have access to this chart"
    assert data["chart_id"] == 42
    assert data["guest_token"] == ""


@pytest.mark.asyncio
async def test_show_chart_success_no_overrides(mcp_server, mock_chart):
    """Happy path: mints a guest token and returns an explore URL with slice_id."""
    with (
        patch(
            "superset.mcp_service.chart.tool.show_chart.find_chart_by_identifier",
            return_value=mock_chart,
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.security_manager",
            new_callable=MagicMock,
        ) as mock_sm,
        patch(
            "superset.mcp_service.chart.tool.show_chart.get_superset_base_url",
            return_value="http://superset.test",
        ),
    ):
        mock_sm.can_access_chart.return_value = True
        mock_sm.get_rls_filters.return_value = []
        mock_sm.create_guest_access_token.return_value = b"signed.jwt.token"
        mock_sm.parse_jwt_guest_token.return_value = {"exp": 1234567890.0}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "show_chart", {"request": {"identifier": "42"}}
            )

    data = json.loads(result.content[0].text)
    assert data["error"] is None
    assert data["chart_id"] == 42
    assert data["chart_uuid"] == str(mock_chart.uuid)
    assert data["viz_type"] == "bar"
    assert data["guest_token"] == "signed.jwt.token"  # noqa: S105
    assert data["expires_at"] == 1234567890.0
    assert data["form_data_key"] is None
    assert "slice_id=42" in data["explore_url"]
    assert "standalone=1" in data["explore_url"]
    # The guest token must travel in the URL fragment, never the query
    # string (fragments stay out of server logs and the Referer header).
    query_part, _, fragment_part = data["explore_url"].partition("#")
    assert "guest_token" not in query_part
    assert "guest_token=signed.jwt.token" in fragment_part

    # Sanity-check: resources claim scoped to this chart's uuid, the token
    # is pinned to the chart's dataset, and no RLS rules apply for a caller
    # with none configured.
    call_kwargs = mock_sm.create_guest_access_token.call_args.kwargs
    assert call_kwargs["resources"] == [{"type": "chart", "id": str(mock_chart.uuid)}]
    assert call_kwargs["rls"] == []
    assert call_kwargs["datasets"] == [7]


@pytest.mark.asyncio
async def test_show_chart_success_with_overrides(mcp_server, mock_chart):
    """With overrides, a form_data_key is cached and embedded in the URL."""
    with (
        patch(
            "superset.mcp_service.chart.tool.show_chart.find_chart_by_identifier",
            return_value=mock_chart,
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.security_manager",
            new_callable=MagicMock,
        ) as mock_sm,
        patch(
            "superset.mcp_service.chart.tool.show_chart.get_superset_base_url",
            return_value="http://superset.test",
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.generate_explore_link",
            return_value="http://superset.test/explore/?form_data_key=CACHEKEY",
        ),
    ):
        mock_sm.can_access_chart.return_value = True
        mock_sm.get_rls_filters.return_value = []
        mock_sm.create_guest_access_token.return_value = "tok"
        mock_sm.parse_jwt_guest_token.return_value = {"exp": 1.0}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "show_chart",
                {
                    "request": {
                        "identifier": "42",
                        "overrides": {"time_range": "Last week"},
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["error"] is None
    assert data["form_data_key"] == "CACHEKEY"
    assert "form_data_key=CACHEKEY" in data["explore_url"]


@pytest.mark.asyncio
async def test_show_chart_inherits_caller_rls(mcp_server, mock_chart):
    """The minted token carries the caller's RLS rules for the datasource.

    Clauses sharing a group_key are OR'd into a single clause (preserving
    RLS group semantics); ungrouped clauses are carried individually.
    """
    rls_rows = [
        MagicMock(group_key=None, clause="tenant_id = 7"),
        MagicMock(group_key="region", clause="region = 'EMEA'"),
        MagicMock(group_key="region", clause="region = 'APAC'"),
    ]
    with (
        patch(
            "superset.mcp_service.chart.tool.show_chart.find_chart_by_identifier",
            return_value=mock_chart,
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.security_manager",
            new_callable=MagicMock,
        ) as mock_sm,
        patch(
            "superset.mcp_service.chart.tool.show_chart.get_superset_base_url",
            return_value="http://superset.test",
        ),
    ):
        mock_sm.can_access_chart.return_value = True
        mock_sm.get_rls_filters.return_value = rls_rows
        mock_sm.create_guest_access_token.return_value = "tok"
        mock_sm.parse_jwt_guest_token.return_value = {"exp": 1.0}

        async with Client(mcp_server) as client:
            await client.call_tool("show_chart", {"request": {"identifier": "42"}})

    mock_sm.get_rls_filters.assert_called_once_with(mock_chart.datasource)
    call_kwargs = mock_sm.create_guest_access_token.call_args.kwargs
    assert call_kwargs["rls"] == [
        {"dataset": "7", "clause": "tenant_id = 7"},
        {"dataset": "7", "clause": "(region = 'EMEA') OR (region = 'APAC')"},
    ]
    assert call_kwargs["datasets"] == [7]


@pytest.mark.asyncio
async def test_show_chart_requires_embedded_superset(mcp_server):
    """Without EMBEDDED_SUPERSET the tool should fail fast with a clear error."""
    with (
        patch(
            "superset.mcp_service.chart.tool.show_chart.is_feature_enabled",
            return_value=False,
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.get_superset_base_url",
            return_value="http://superset.test",
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "show_chart", {"request": {"identifier": "42"}}
            )
    data = json.loads(result.content[0].text)
    assert data["error"] is not None
    assert "EMBEDDED_SUPERSET" in data["error"]
    assert data["explore_url"] == ""
    assert data["guest_token"] == ""
