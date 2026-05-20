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

"""Unit tests for list_action_logs and get_action_log_info MCP tools."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client
from pydantic import ValidationError

from superset.mcp_service.action_log.schemas import (
    ActionLogFilter,
    ListActionLogsRequest,
)
from superset.mcp_service.app import mcp
from superset.utils import json


def create_mock_log(
    log_id: int = 1,
    action: str = "log",
    user_id: int = 1,
    dashboard_id: int | None = None,
    slice_id: int | None = None,
    json_payload: str | None = None,
    dttm: datetime | None = None,
) -> MagicMock:
    log = MagicMock()
    log.id = log_id
    log.action = action
    log.user_id = user_id
    log.dashboard_id = dashboard_id
    log.slice_id = slice_id
    log.json = json_payload or '{"event_name": "explore_slice"}'
    log.dttm = dttm or datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    log.duration_ms = None
    log.referrer = None
    return log


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    from unittest.mock import Mock

    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


class TestActionLogFilterSchema:
    def test_valid_filter_columns_accepted(self):
        for col in ("action", "user_id", "dashboard_id", "slice_id", "dttm"):
            f = ActionLogFilter(col=col, opr="eq", value="test")
            assert f.col == col

    def test_invalid_filter_column_rejected(self):
        with pytest.raises(ValidationError):
            ActionLogFilter(col="not_a_column", opr="eq", value="x")

    def test_created_by_fk_rejected(self):
        with pytest.raises(ValidationError):
            ActionLogFilter(col="created_by_fk", opr="eq", value=1)


@patch("superset.daos.log.LogDAO.list")
@pytest.mark.asyncio
async def test_list_action_logs_basic(mock_list, mcp_server):
    """Basic listing returns structured response."""
    log = create_mock_log()
    mock_list.return_value = ([log], 1)

    async with Client(mcp_server) as client:
        result = await client.call_tool("list_action_logs", {})

    data = json.loads(result.content[0].text)
    assert data["action_logs"] is not None
    assert len(data["action_logs"]) == 1
    assert data["action_logs"][0]["id"] == 1
    assert data["action_logs"][0]["action"] == "log"
    assert data["action_logs"][0]["user_id"] == 1


@patch("superset.daos.log.LogDAO.list")
@pytest.mark.asyncio
async def test_list_action_logs_default_7day_filter_applied(mock_list, mcp_server):
    """When no dttm filter is provided, a 7-day filter is injected automatically."""
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        await client.call_tool("list_action_logs", {})

    # Verify list() was called with a dttm filter in column_operators
    call_kwargs = mock_list.call_args.kwargs
    col_operators = call_kwargs.get("column_operators", [])
    dttm_filters = [f for f in col_operators if getattr(f, "col", None) == "dttm"]
    assert len(dttm_filters) == 1
    assert dttm_filters[0].opr == "gte"


@patch("superset.daos.log.LogDAO.list")
@pytest.mark.asyncio
async def test_list_action_logs_explicit_dttm_filter_skips_default(
    mock_list, mcp_server
):
    """When a dttm filter is provided, the default 7-day filter is NOT injected."""
    mock_list.return_value = ([], 0)

    request = ListActionLogsRequest(
        filters=[{"col": "dttm", "opr": "gte", "value": "2020-01-01T00:00:00"}]
    )

    async with Client(mcp_server) as client:
        await client.call_tool("list_action_logs", {"request": request.model_dump()})

    call_kwargs = mock_list.call_args.kwargs
    col_operators = call_kwargs.get("column_operators", [])
    dttm_filters = [f for f in col_operators if getattr(f, "col", None) == "dttm"]
    # Only the user-provided filter, not the injected default
    assert len(dttm_filters) == 1
    assert dttm_filters[0].value == "2020-01-01T00:00:00"


@patch("superset.daos.log.LogDAO.list")
@pytest.mark.asyncio
async def test_list_action_logs_default_sort_is_dttm_desc(mock_list, mcp_server):
    """Default sort is dttm descending (most recent first)."""
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        await client.call_tool("list_action_logs", {})

    call_kwargs = mock_list.call_args.kwargs
    assert call_kwargs.get("order_column") == "dttm"
    assert call_kwargs.get("order_direction") == "desc"


@patch("superset.daos.log.LogDAO.list")
@pytest.mark.asyncio
async def test_list_action_logs_pagination(mock_list, mcp_server):
    """Pagination metadata is correct."""
    logs = [create_mock_log(log_id=i) for i in range(1, 6)]
    mock_list.return_value = (logs, 20)

    async with Client(mcp_server) as client:
        request = ListActionLogsRequest(page=1, page_size=5)
        result = await client.call_tool(
            "list_action_logs", {"request": request.model_dump()}
        )

    data = json.loads(result.content[0].text)
    assert data["count"] == 5
    assert data["total_count"] == 20
    assert data["page"] == 1
    assert data["page_size"] == 5
    assert data["has_next"] is True
    assert data["has_previous"] is False


@patch("superset.daos.log.LogDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_action_log_info_basic(mock_find, mcp_server):
    """get_action_log_info returns log details by integer ID."""
    log = create_mock_log(log_id=42, action="explore_chart", user_id=7)
    mock_find.return_value = log

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_action_log_info", {"request": {"identifier": 42}}
        )

    data = json.loads(result.content[0].text)
    assert data["id"] == 42
    assert data["action"] == "explore_chart"
    assert data["user_id"] == 7


@patch("superset.daos.log.LogDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_action_log_info_not_found(mock_find, mcp_server):
    """get_action_log_info returns error when log does not exist."""
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_action_log_info", {"request": {"identifier": 9999}}
        )

    data = json.loads(result.content[0].text)
    assert data["error_type"] == "not_found"
