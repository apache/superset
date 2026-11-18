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

"""Contract tests for dashboard self-lookup filters and strict requests."""

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from superset.mcp_service.app import mcp


@pytest.mark.asyncio
@pytest.mark.parametrize("column_alias", ["columns", "select_columns"])
@pytest.mark.parametrize(
    ("created", "edited", "expected_column"),
    [
        (True, False, "created_by_fk"),
        (False, True, "editor"),
        (True, True, "created_by_fk_or_editor"),
    ],
)
async def test_list_dashboards_self_lookup_and_aliases(
    column_alias: str, created: bool, edited: bool, expected_column: str
) -> None:
    """Flags and aliases survive validation and reach the DAO without intersecting."""
    user = Mock(id=42, username="admin", is_authenticated=True)
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch("superset.mcp_service.mcp_core.get_current_user", return_value=user),
        patch("superset.daos.dashboard.DashboardDAO.list", return_value=([], 0)) as dao,
    ):
        async with Client(mcp) as client:
            await client.call_tool(
                "list_dashboards",
                {
                    "request": {
                        "created_by_me": created,
                        "edited_by_me": edited,
                        column_alias: ["id"],
                        "order_column": "changed_on_delta_humanized",
                        "filters": [{"col": "published", "opr": "eq", "value": True}],
                    }
                },
            )
    filters = dao.call_args.kwargs["column_operators"]
    assert [(item.col, item.opr, item.value) for item in filters] == [
        (expected_column, "eq", 42),
        ("published", "eq", True),
    ]
    assert dao.call_args.kwargs["columns"] == ["id"]
    assert dao.call_args.kwargs["order_column"] == "changed_on"


@pytest.mark.asyncio
async def test_list_dashboards_unknown_scope_never_reaches_dao() -> None:
    """Unsupported ownership flags fail instead of returning an unscoped list."""
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request", return_value=Mock(id=42)
        ),
        patch("superset.daos.dashboard.DashboardDAO.list") as dao,
    ):
        async with Client(mcp) as client:
            with pytest.raises(ToolError, match="did you mean 'edited_by_me'"):
                await client.call_tool(
                    "list_dashboards", {"request": {"owned_by_me": True}}
                )
    dao.assert_not_called()
