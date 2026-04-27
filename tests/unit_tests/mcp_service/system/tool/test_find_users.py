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

"""Tests for find_users MCP tool and its filter contract."""

import importlib
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.system.schemas import FindUsersRequest, FindUsersResponse
from superset.utils import json

# Import the submodule directly so ``patch.object`` targets the module (not the
# ``find_users`` function that ``tool/__init__.py`` re-exports onto the
# package). The package attribute is the function, so dotted-string patches
# like ``superset.mcp_service.system.tool.find_users.db`` can resolve to the
# function in some import orderings and fail with AttributeError.
find_users_module = importlib.import_module(
    "superset.mcp_service.system.tool.find_users"
)


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _make_user(id_, username, first=None, last=None, email=None, active=True):
    """Build a Mock user with the attributes serialize_user_object reads."""
    user = Mock(
        spec=["id", "username", "first_name", "last_name", "email", "active", "roles"]
    )
    user.id = id_
    user.username = username
    user.first_name = first
    user.last_name = last
    user.email = email
    user.active = active
    user.roles = []
    return user


def _patch_user_query(rows):
    """Patch the SQLAlchemy chain used by find_users to return a fixed result set."""
    chain = MagicMock()
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.limit.return_value = chain
    chain.all.return_value = rows
    session = MagicMock()
    session.query.return_value = chain
    return session, chain


# ---------------------------------------------------------------------------
# Schema tests
# ---------------------------------------------------------------------------


def test_find_users_request_rejects_empty_query():
    with pytest.raises(ValidationError):
        FindUsersRequest(query="")


def test_find_users_request_rejects_extra_fields():
    with pytest.raises(ValidationError):
        FindUsersRequest(query="maxime", random_field="x")


def test_find_users_response_default_truncated_false():
    resp = FindUsersResponse(users=[], count=0)
    assert resp.truncated is False


# ---------------------------------------------------------------------------
# Tool-level tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_find_users_returns_matches(mcp_server):
    rows = [
        _make_user(
            7, "maxime", first="Maxime", last="Beauchemin", email="m@example.com"
        )
    ]
    session, _ = _patch_user_query(rows)

    with (
        patch.object(find_users_module, "db") as mock_db,
        patch.object(find_users_module, "security_manager") as mock_sm,
        patch.object(find_users_module, "or_") as mock_or,
    ):
        mock_db.session = session
        mock_sm.user_model = MagicMock()
        mock_or.return_value = MagicMock()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "find_users", {"request": {"query": "maxime"}}
            )

    data = json.loads(result.content[0].text)
    assert data["count"] == 1
    assert data["truncated"] is False
    assert data["users"][0]["id"] == 7
    assert data["users"][0]["username"] == "maxime"
    assert data["users"][0]["first_name"] == "Maxime"
    assert data["users"][0]["last_name"] == "Beauchemin"
    # Privacy: minimal projection excludes identity attributes that aren't
    # required for filter resolution. Catch regressions on the response shape.
    for forbidden in ("email", "active", "roles"):
        assert forbidden not in data["users"][0]
    # or_ should have been built across the four matched columns
    assert mock_or.called
    assert len(mock_or.call_args.args) == 4


@pytest.mark.asyncio
async def test_find_users_truncates_when_more_rows_than_page_size(mcp_server):
    # page_size=2 with 3 returned rows -> truncated, response trimmed to 2
    rows = [
        _make_user(1, "a"),
        _make_user(2, "b"),
        _make_user(3, "c"),
    ]
    session, chain = _patch_user_query(rows)

    with (
        patch.object(find_users_module, "db") as mock_db,
        patch.object(find_users_module, "security_manager") as mock_sm,
        patch.object(find_users_module, "or_") as mock_or,
    ):
        mock_db.session = session
        mock_sm.user_model = MagicMock()
        mock_or.return_value = MagicMock()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "find_users", {"request": {"query": "a", "page_size": 2}}
            )

    # Tool requested page_size+1 rows for truncation detection
    chain.limit.assert_called_with(3)

    data = json.loads(result.content[0].text)
    assert data["count"] == 2
    assert data["truncated"] is True
    assert [u["id"] for u in data["users"]] == [1, 2]


@pytest.mark.asyncio
async def test_find_users_rejects_empty_query_via_client(mcp_server):
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool("find_users", {"request": {"query": ""}})


@pytest.mark.parametrize("blank", [" ", "   ", "\t", "\n  \t"])
def test_find_users_request_rejects_whitespace_only_query(blank):
    # Whitespace-only queries would strip to "" and produce a LIKE "%%" pattern
    # that enumerates the entire user directory. The validator must reject them.
    with pytest.raises(ValidationError):
        FindUsersRequest(query=blank)


def test_find_users_request_strips_query_whitespace():
    # Validator should normalize the stored query so downstream LIKE patterns
    # don't carry leading/trailing whitespace.
    request = FindUsersRequest(query="  maxime  ")
    assert request.query == "maxime"


# ---------------------------------------------------------------------------
# Filter contract: created_by_fk / changed_by_fk filtering on list tools
# ---------------------------------------------------------------------------


@patch("superset.daos.dashboard.DashboardDAO.list")
@pytest.mark.asyncio
async def test_list_dashboards_passes_created_by_fk_filter_to_dao(
    mock_list, mcp_server
):
    """list_dashboards should accept created_by_fk filter and forward it."""
    mock_list.return_value = ([], 0)
    async with Client(mcp_server) as client:
        await client.call_tool(
            "list_dashboards",
            {
                "request": {
                    "filters": [{"col": "created_by_fk", "opr": "eq", "value": 7}],
                    "page": 1,
                    "page_size": 10,
                }
            },
        )

    assert mock_list.called
    forwarded_filters = mock_list.call_args.kwargs.get("column_operators")
    assert forwarded_filters is not None
    assert any(
        getattr(f, "col", None) == "created_by_fk" and getattr(f, "value", None) == 7
        for f in forwarded_filters
    )


@patch("superset.daos.chart.ChartDAO.list")
@pytest.mark.asyncio
async def test_list_charts_passes_changed_by_fk_filter_to_dao(mock_list, mcp_server):
    """list_charts should accept changed_by_fk filter and forward it."""
    mock_list.return_value = ([], 0)
    async with Client(mcp_server) as client:
        await client.call_tool(
            "list_charts",
            {
                "request": {
                    "filters": [{"col": "changed_by_fk", "opr": "eq", "value": 7}],
                    "page": 1,
                    "page_size": 10,
                }
            },
        )

    assert mock_list.called
    forwarded_filters = mock_list.call_args.kwargs.get("column_operators")
    assert forwarded_filters is not None
    assert any(getattr(f, "col", None) == "changed_by_fk" for f in forwarded_filters)
