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
Unit tests for the create_rls_filter MCP tool.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        user = MagicMock()
        user.id = 1
        user.username = "admin"
        mock_get_user.return_value = user
        yield mock_get_user


def _make_rls_rule(
    id: int = 42,
    name: str = "EMEA filter",
    filter_type: str = "Regular",
    clause: str = "region = 'EMEA'",
    table_ids: list[int] | None = None,
    role_ids: list[int] | None = None,
) -> MagicMock:
    rule = MagicMock()
    rule.id = id
    rule.name = name
    rule.filter_type = filter_type
    rule.clause = clause

    table_ids = table_ids or [1]
    role_ids = role_ids or [2]

    tables = []
    for tid in table_ids:
        t = MagicMock()
        t.id = tid
        tables.append(t)
    rule.tables = tables

    roles = []
    for rid in role_ids:
        r = MagicMock()
        r.id = rid
        roles.append(r)
    rule.roles = roles

    rule.group_key = None
    rule.description = None
    return rule


_BASE_REQUEST = {
    "name": "EMEA filter",
    "filter_type": "Regular",
    "tables": [1],
    "roles": [2],
    "clause": "region = 'EMEA'",
}


@patch("superset.commands.security.create.CreateRLSRuleCommand")
@pytest.mark.asyncio
async def test_create_rls_filter_success(
    mock_cmd_cls: MagicMock, mcp_server: object
) -> None:
    """Happy path: returns id, name, filter_type, clause, and table/role IDs."""
    rule = _make_rls_rule()
    mock_cmd = MagicMock()
    mock_cmd.run.return_value = rule
    mock_cmd_cls.return_value = mock_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool("create_rls_filter", {"request": _BASE_REQUEST})

    data = result.structured_content
    assert data["id"] == 42
    assert data["name"] == "EMEA filter"
    assert data["filter_type"] == "Regular"
    assert data["clause"] == "region = 'EMEA'"
    assert data["tables"] == [1]
    assert data["roles"] == [2]
    assert data["error"] is None


@patch("superset.commands.security.create.CreateRLSRuleCommand")
@pytest.mark.asyncio
async def test_create_rls_filter_role_not_found(
    mock_cmd_cls: MagicMock, mcp_server: object
) -> None:
    """Returns structured error when a role ID does not exist."""
    from superset.commands.exceptions import RolesNotFoundValidationError

    mock_cmd = MagicMock()
    mock_cmd.run.side_effect = RolesNotFoundValidationError()
    mock_cmd_cls.return_value = mock_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool("create_rls_filter", {"request": _BASE_REQUEST})

    data = result.structured_content
    assert data["id"] is None
    assert data["error"] is not None


@patch("superset.commands.security.create.CreateRLSRuleCommand")
@pytest.mark.asyncio
async def test_create_rls_filter_table_not_found(
    mock_cmd_cls: MagicMock, mcp_server: object
) -> None:
    """Returns structured error when a table ID does not exist."""
    from superset.commands.exceptions import DatasourceNotFoundValidationError

    mock_cmd = MagicMock()
    mock_cmd.run.side_effect = DatasourceNotFoundValidationError()
    mock_cmd_cls.return_value = mock_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool("create_rls_filter", {"request": _BASE_REQUEST})

    data = result.structured_content
    assert data["id"] is None
    assert data["error"] is not None


@patch("superset.commands.security.create.CreateRLSRuleCommand")
@pytest.mark.asyncio
async def test_create_rls_filter_base_type(
    mock_cmd_cls: MagicMock, mcp_server: object
) -> None:
    """Base filter type is stored and returned correctly."""
    rule = _make_rls_rule(filter_type="Base")
    mock_cmd = MagicMock()
    mock_cmd.run.return_value = rule
    mock_cmd_cls.return_value = mock_cmd

    request = {**_BASE_REQUEST, "filter_type": "Base"}
    async with Client(mcp_server) as client:
        result = await client.call_tool("create_rls_filter", {"request": request})

    data = result.structured_content
    assert data["filter_type"] == "Base"
    assert data["error"] is None


@patch("superset.commands.security.create.CreateRLSRuleCommand")
@pytest.mark.asyncio
async def test_create_rls_filter_with_optional_fields(
    mock_cmd_cls: MagicMock, mcp_server: object
) -> None:
    """Optional group_key and description are included in the response."""
    rule = _make_rls_rule()
    rule.group_key = "geo"
    rule.description = "Restrict to EMEA region"
    mock_cmd = MagicMock()
    mock_cmd.run.return_value = rule
    mock_cmd_cls.return_value = mock_cmd

    request = {
        **_BASE_REQUEST,
        "group_key": "geo",
        "description": "Restrict to EMEA region",
    }
    async with Client(mcp_server) as client:
        result = await client.call_tool("create_rls_filter", {"request": request})

    data = result.structured_content
    assert data["group_key"] == "geo"
    assert data["description"] == "Restrict to EMEA region"
    assert data["error"] is None
