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
Unit tests for the update_rls_filter MCP tool.
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


@patch("superset.commands.security.update.UpdateRLSRuleCommand")
@patch("superset.daos.security.RLSDAO")
@pytest.mark.asyncio
async def test_update_rls_filter_success(
    mock_dao: MagicMock, mock_cmd_cls: MagicMock, mcp_server: object
) -> None:
    """Happy path: returns updated id, name, and changed clause."""
    existing = _make_rls_rule()
    mock_dao.find_by_id.return_value = existing

    updated = _make_rls_rule(clause="region = 'APAC'")
    mock_cmd = MagicMock()
    mock_cmd.run.return_value = updated
    mock_cmd_cls.return_value = mock_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "update_rls_filter",
            {"request": {"id": 42, "clause": "region = 'APAC'"}},
        )

    data = result.structured_content
    assert data["id"] == 42
    assert data["clause"] == "region = 'APAC'"
    assert data["error"] is None


@patch("superset.daos.security.RLSDAO")
@pytest.mark.asyncio
async def test_update_rls_filter_not_found(
    mock_dao: MagicMock, mcp_server: object
) -> None:
    """Returns a structured error when the RLS rule ID does not exist."""
    mock_dao.find_by_id.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "update_rls_filter",
            {"request": {"id": 999}},
        )

    data = result.structured_content
    assert data["id"] is None
    assert data["error"] is not None
    assert "999" in (data["error"] or "")


@patch("superset.commands.security.update.UpdateRLSRuleCommand")
@patch("superset.daos.security.RLSDAO")
@pytest.mark.asyncio
async def test_update_rls_filter_role_not_found(
    mock_dao: MagicMock, mock_cmd_cls: MagicMock, mcp_server: object
) -> None:
    """Returns structured error when a role ID does not exist."""
    from superset.commands.exceptions import RolesNotFoundValidationError

    existing = _make_rls_rule()
    mock_dao.find_by_id.return_value = existing

    mock_cmd = MagicMock()
    mock_cmd.run.side_effect = RolesNotFoundValidationError()
    mock_cmd_cls.return_value = mock_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "update_rls_filter",
            {"request": {"id": 42, "roles": [9999]}},
        )

    data = result.structured_content
    assert data["id"] is None
    assert data["error"] is not None


@patch("superset.commands.security.update.UpdateRLSRuleCommand")
@patch("superset.daos.security.RLSDAO")
@pytest.mark.asyncio
async def test_update_rls_filter_table_not_found(
    mock_dao: MagicMock, mock_cmd_cls: MagicMock, mcp_server: object
) -> None:
    """Returns structured error when a table ID does not exist."""
    from superset.commands.exceptions import DatasourceNotFoundValidationError

    existing = _make_rls_rule()
    mock_dao.find_by_id.return_value = existing

    mock_cmd = MagicMock()
    mock_cmd.run.side_effect = DatasourceNotFoundValidationError()
    mock_cmd_cls.return_value = mock_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "update_rls_filter",
            {"request": {"id": 42, "tables": [9999]}},
        )

    data = result.structured_content
    assert data["id"] is None
    assert data["error"] is not None


@patch("superset.commands.security.update.UpdateRLSRuleCommand")
@patch("superset.daos.security.RLSDAO")
@pytest.mark.asyncio
async def test_update_rls_filter_partial_update(
    mock_dao: MagicMock, mock_cmd_cls: MagicMock, mcp_server: object
) -> None:
    """Omitted fields retain existing values; only the changed field is updated."""
    existing = _make_rls_rule(name="Old name", clause="region = 'EMEA'")
    mock_dao.find_by_id.return_value = existing

    updated = _make_rls_rule(name="New name", clause="region = 'EMEA'")
    mock_cmd = MagicMock()
    mock_cmd.run.return_value = updated
    mock_cmd_cls.return_value = mock_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "update_rls_filter",
            {"request": {"id": 42, "name": "New name"}},
        )

    data = result.structured_content
    assert data["name"] == "New name"
    assert data["clause"] == "region = 'EMEA'"
    assert data["error"] is None
