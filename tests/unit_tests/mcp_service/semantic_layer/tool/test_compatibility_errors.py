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
"""Keep compatibility failure details out of MCP client messages."""

from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pytest
from fastmcp import Client, Context
from fastmcp.client.client import CallToolResult

from superset.exceptions import QueryObjectValidationError
from superset.mcp_service.app import mcp
from superset.semantic_layers.dimension_resolution import AmbiguousDimensionError
from superset.utils import json


@pytest.mark.usefixtures("semantic_layers_enabled")
@pytest.mark.asyncio
@pytest.mark.parametrize("member", ["metrics", "dimensions"])
@pytest.mark.parametrize("external", [False, True])
@pytest.mark.parametrize("error_class", [RuntimeError, QueryObjectValidationError])
async def test_compatibility_errors_use_fixed_messages(
    member: str,
    external: bool,
    error_class: type[Exception],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Results and client notifications stay fixed while server diagnostics survive."""
    tool_name: str = f"get_compatible_{member}"
    error: Exception = error_class("provider-private-detail")
    view: MagicMock = MagicMock(metrics=[], columns=[])
    getattr(view, tool_name).side_effect = error
    user: MagicMock = MagicMock(id=1, username="admin")
    message: str = f"Unable to retrieve compatible {member}."
    notify: AsyncMock
    client: Client
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch(
            f"superset.mcp_service.semantic_layer.tool.{tool_name}"
            ".user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            side_effect=error,
        ),
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id",
            return_value=view,
        ),
        patch.object(Context, "error", new_callable=AsyncMock) as notify,
    ):
        async with Client(mcp) as client:
            result: CallToolResult = await client.call_tool(
                tool_name,
                {"request": {"view_id" if external else "dataset_id": 5}},
            )
        data: dict[str, object] = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "InternalError"
    assert data["error"] == message
    assert data["message"] == message
    assert "provider-private-detail" not in str(result)
    notify.assert_awaited_once_with(message)
    assert f"{error_class.__name__}: provider-private-detail" in caplog.text


@pytest.mark.usefixtures("semantic_layers_enabled")
@pytest.mark.asyncio
@pytest.mark.parametrize("member", ["metrics", "dimensions"])
@pytest.mark.parametrize("failure_site", ["columns", "compatibility"])
async def test_compatibility_preserves_host_ambiguity(
    member: str, failure_site: str
) -> None:
    """Authorized clients receive actionable host validation, not provider errors."""
    tool_name: str = f"get_compatible_{member}"
    message: str = "Semantic dimension 'x' has ambiguous variants for grain 'day'."
    error: AmbiguousDimensionError = AmbiguousDimensionError(message)
    view: MagicMock = MagicMock(metrics=[], columns=[])
    if failure_site == "compatibility":
        getattr(view, tool_name).side_effect = error
    user: MagicMock = MagicMock(id=1, username="admin")
    notify: AsyncMock
    client: Client
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch(
            f"superset.mcp_service.semantic_layer.tool.{tool_name}"
            ".user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id",
            return_value=view,
        ),
        patch.object(
            type(view),
            "columns",
            new_callable=PropertyMock,
            create=True,
            return_value=[],
            side_effect=error if failure_site == "columns" else None,
        ),
        patch.object(Context, "error", new_callable=AsyncMock) as notify,
    ):
        async with Client(mcp) as client:
            result: CallToolResult = await client.call_tool(
                tool_name, {"request": {"view_id": 5}}
            )
        data: dict[str, object] = json.loads(result.content[0].text)

    view.raise_for_access.assert_called_once_with()
    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert data["error"] == message
    assert data["message"] == message
    notify.assert_not_awaited()
